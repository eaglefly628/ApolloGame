"""Synthetic local fixtures only; never reads a real asset library or external disk."""
import copy
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import types
import unittest
from unittest import mock
import vault


class VaultTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="asset-vault-test-")
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "a.bin").write_bytes(b"synthetic art bytes")
        (self.source / "empty").mkdir()
        self.target = self.root / "vault"
        self.target.mkdir()
        self.sources = {"art": self.source}

    def tearDown(self):
        self.temp.cleanup()

    def backup(self, **kwargs):
        return vault.backup(self.sources, self.target, apply=True, reserve_bytes=0, **kwargs)

    def manifest_path(self, result):
        return self.target / "snapshots" / result["snapshot"] / "complete.json"

    def object_path(self, result):
        entries = json.loads(self.manifest_path(result).read_text())["entries"]
        row = next(e for e in entries if e["kind"] == "file")
        return self.target / "objects" / row["sha256"] / row["objectId"] / "data"

    def assert_no_published(self):
        self.assertFalse(list((self.target / "snapshots").glob("*/complete.json")))

    def test_default_plan_never_hashes_or_writes(self):
        before = list(self.target.iterdir())
        with mock.patch.object(vault, "hash_file", side_effect=AssertionError("no content reads")), mock.patch.object(Path, "open", side_effect=AssertionError("no file opens")):
            result = vault.backup(self.sources, self.target, reserve_bytes=0)
        self.assertTrue(result["dryRun"])
        self.assertEqual(result["sourceBytes"], len(b"synthetic art bytes"))
        self.assertEqual(before, list(self.target.iterdir()))

    def test_backup_verify_restore_multiple_aliases_and_empty_directory(self):
        second = self.root / "second"
        second.mkdir()
        (second / "texture").write_bytes(b"texture bytes")
        self.sources["textures"] = second
        before = {p: p.read_bytes() for p in [self.source / "a.bin", second / "texture"]}
        result = self.backup()
        self.assertTrue(vault.verify(self.target, result["snapshot"])["verified"])
        manifest = json.loads(self.manifest_path(result).read_text())
        self.assertEqual(manifest["sources"], ["art", "textures"])
        self.assertNotIn(str(self.root), self.manifest_path(result).read_text())
        dest = self.root / "restored"
        vault.restore(self.target, result["snapshot"], dest)
        self.assertEqual((dest / "art/a.bin").read_bytes(), before[self.source / "a.bin"])
        self.assertTrue((dest / "art/empty").is_dir())
        self.assertEqual((dest / "textures/texture").read_bytes(), b"texture bytes")
        for path, content in before.items():
            self.assertEqual(path.read_bytes(), content)
        self.assertNotEqual(self.object_path(result).stat().st_ino, (self.source / "a.bin").stat().st_ino)

    def test_incremental_reuses_verified_objects_without_overwriting_snapshot(self):
        first = self.backup()
        old = self.manifest_path(first).read_bytes()
        second = self.backup()
        self.assertEqual(second["copiedObjects"], 0)
        self.assertEqual(second["reusedObjects"], 1)
        self.assertNotEqual(first["snapshot"], second["snapshot"])
        self.assertEqual(self.manifest_path(first).read_bytes(), old)

    def test_corrupt_existing_object_fails_not_reused_or_overwritten(self):
        first = self.backup()
        data = self.object_path(first)
        data.write_bytes(b"bad")
        with self.assertRaisesRegex(vault.VaultError, "SHA"):
            self.backup()
        self.assertEqual(data.read_bytes(), b"bad")
        with self.assertRaisesRegex(vault.VaultError, "SHA"):
            vault.verify(self.target, first["snapshot"])

    def test_partial_copy_kept_and_retry_uses_fresh_object(self):
        original = vault.copy_source
        def fail(_source, destination, _expected):
            destination.write_bytes(b"partial")
            raise OSError("simulated disconnect during copy")
        with mock.patch.object(vault, "copy_source", side_effect=fail):
            with self.assertRaisesRegex(OSError, "disconnect"):
                self.backup()
        self.assert_no_published()
        partial = next((self.target / "objects").glob("*/*/data"))
        self.assertEqual(partial.read_bytes(), b"partial")
        self.assertIn('"state": "failed"', next((self.target / "logs").iterdir()).read_text())
        result = self.backup()
        self.assertTrue(vault.verify(self.target, result["snapshot"])["verified"])
        self.assertEqual(partial.read_bytes(), b"partial")
        self.assertNotEqual(partial, self.object_path(result))

    def test_failure_after_one_object_reuses_that_verified_object(self):
        (self.source / "b.bin").write_bytes(b"second")
        original = vault.copy_source
        def fail(source, dest, expected):
            if source.name == "b.bin":
                raise OSError("copy failed")
            return original(source, dest, expected)
        with mock.patch.object(vault, "copy_source", side_effect=fail):
            with self.assertRaises(OSError):
                self.backup()
        result = self.backup()
        self.assertEqual(result["reusedObjects"], 1)
        self.assertEqual(result["copiedObjects"], 1)

    def test_source_change_during_copy_never_publishes(self):
        original = vault.copy_source
        def changed(source, dest, expected):
            value = original(source, dest, expected)
            source.write_bytes(b"new source data")
            return value
        with mock.patch.object(vault, "copy_source", side_effect=changed):
            with self.assertRaisesRegex(vault.VaultError, "source changed"):
                self.backup()
        self.assert_no_published()
        self.assertEqual((self.source / "a.bin").read_bytes(), b"new source data")

    def test_target_root_replacement_detected_and_foreign_target_not_written(self):
        original = vault.copy_source
        moved = self.root / "disconnected-vault"
        def changed(source, dest, expected):
            result = original(source, dest, expected)
            self.target.rename(moved)
            self.target.mkdir()
            return result
        with mock.patch.object(vault, "copy_source", side_effect=changed):
            with self.assertRaisesRegex(vault.VaultError, "target root"):
                self.backup()
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertFalse(list((moved / "snapshots").glob("*/complete.json")))
        self.assertIn('"state": "failed"', next((moved / "logs").iterdir()).read_text())

    def test_low_space_is_dry_and_dynamic_low_space_refuses(self):
        with self.assertRaisesRegex(vault.VaultError, "capacity"):
            vault.plan(self.sources, self.target, reserve_bytes=0, free_bytes=0)
        self.assertEqual(list(self.target.iterdir()), [])
        disk = types.SimpleNamespace(free=10**9)
        with mock.patch.object(vault.shutil, "disk_usage", side_effect=[disk, types.SimpleNamespace(free=0)]):
            with self.assertRaisesRegex(vault.VaultError, "capacity"):
                self.backup()
        self.assert_no_published()

    def test_unknown_nonempty_target_and_marker_version_refused(self):
        foreign = self.target / "user-file"
        foreign.write_text("preserve")
        with self.assertRaises(vault.VaultError):
            self.backup()
        self.assertEqual(foreign.read_text(), "preserve")
        foreign.unlink()
        (self.target / "vault.json").write_text('{"schema":"apollo-asset-vault","version":999}')
        with self.assertRaisesRegex(vault.VaultError, "marker"):
            self.backup()

    def test_existing_lock_is_not_cleared(self):
        self.backup()
        lock = self.target / ".write-lock"
        lock.mkdir()
        (lock / "owner").write_text("other writer")
        with self.assertRaises(FileExistsError):
            self.backup()
        self.assertEqual((lock / "owner").read_text(), "other writer")

    def test_overlap_and_alias_collisions_refused(self):
        for sources, target in [({"art": self.source}, self.source), ({"art": self.root}, self.target), ({"art": self.source, "more": self.source / "empty"}, self.target), ({"Art": self.source, "art": self.root / "unused"}, self.target)]:
            with self.assertRaises((vault.VaultError, FileNotFoundError)):
                vault.plan(sources, target, reserve_bytes=0)

    def test_casefold_and_unicode_normalization_collisions_refused(self):
        for names in [("Art", "art"), ("é", "e\u0301")]:
            with tempfile.TemporaryDirectory(dir=self.root) as source:
                for name in names:
                    (Path(source) / name).write_bytes(name.encode())
                # macOS may normalize/casefold the names at creation. Test only distinct entries.
                if len(list(Path(source).iterdir())) == 2:
                    expected = "collision" if names == ("Art", "art") else "collision|source name must already be NFC"
                    with self.assertRaisesRegex(vault.VaultError, expected):
                        vault.plan({"art": source}, self.target, reserve_bytes=0)

    def test_distinct_unicode_entries_refused_even_on_normalizing_filesystem(self):
        # Reproduce Linux enumeration without relying on the host filesystem allowing
        # both spellings. The non-NFC entry must be refused before any file read.
        original_iterdir = Path.iterdir
        canonical_source = self.source.resolve()
        seen = []
        def entries(directory):
            if directory == canonical_source:
                seen.append(directory)
                return iter([canonical_source / "é", canonical_source / "e\u0301"])
            return original_iterdir(directory)
        with mock.patch.object(Path, "iterdir", entries):
            with self.assertRaisesRegex(vault.VaultError, "source name must already be NFC"):
                vault.plan(self.sources, self.target, reserve_bytes=0)
        self.assertEqual(seen, [canonical_source])
        self.assertEqual(list(self.target.iterdir()), [])

    def test_windows_reserved_and_path_escape_names_refused(self):
        for name in ["CON", "nul.txt", "COM1.bin", "bad.", "bad ", "a:b", "../escape", "/absolute"]:
            with self.assertRaises(vault.VaultError):
                vault.part(name)
        for path in ["../escape", "/absolute", "a//b", "a/../b", "a\\b"]:
            with self.assertRaises(vault.VaultError):
                vault.relpath(path)

    @unittest.skipUnless(hasattr(os, "symlink"), "no symlink support")
    def test_internal_symlinks_are_metadata_and_restore_after_files(self):
        os.symlink("a.bin", self.source / "alias.bin")
        os.symlink("empty", self.source / "directory-alias")
        result = self.backup()
        manifest = json.loads(self.manifest_path(result).read_text())
        links = [e for e in manifest["entries"] if e["kind"] == "symlink"]
        self.assertEqual(len(links), 2)
        self.assertTrue(all(e["target"] in ("a.bin", "empty") for e in links))
        self.assertFalse(any(p.is_symlink() for p in self.target.rglob("*")))
        dest = self.root / "restored"
        vault.restore(self.target, result["snapshot"], dest)
        self.assertTrue((dest / "art/alias.bin").is_symlink())
        self.assertEqual((dest / "art/alias.bin").read_bytes(), b"synthetic art bytes")

    @unittest.skipUnless(hasattr(os, "symlink"), "no symlink support")
    def test_external_absolute_broken_and_loop_symlinks_refused(self):
        outside = self.root / "outside"
        outside.write_bytes(b"outside")
        for target in ["../outside", str(self.source / "a.bin"), "missing", "link"]:
            link = self.source / "link"
            os.symlink(target, link)
            try:
                with self.assertRaises((vault.VaultError, FileNotFoundError, RuntimeError, OSError)):
                    self.backup()
                self.assertEqual(list(self.target.iterdir()), [])
            finally:
                link.unlink()

    def test_git_destination_and_source_git_nodes_refused(self):
        repo = self.root / "repo"
        repo.mkdir()
        for directory_marker in [False, True]:
            marker = repo / ".git"
            marker.mkdir() if directory_marker else marker.write_text("gitdir: elsewhere")
            nested = repo / "backup"
            nested.mkdir()
            with self.assertRaisesRegex(vault.VaultError, "Git"):
                vault.plan(self.sources, nested, reserve_bytes=0)
            nested.rmdir()
            marker.rmdir() if directory_marker else marker.unlink()
        (self.source / ".git").write_text("gitdir: external")
        with self.assertRaisesRegex(vault.VaultError, "Git"):
            self.backup()

    def test_restore_git_and_existing_destination_refused(self):
        result = self.backup()
        dest = self.root / "existing"
        dest.mkdir()
        (dest / "user").write_text("preserve")
        with self.assertRaises(vault.VaultError):
            vault.restore(self.target, result["snapshot"], dest)
        self.assertEqual((dest / "user").read_text(), "preserve")
        (self.root / ".git").write_text("gitdir: elsewhere")
        with self.assertRaisesRegex(vault.VaultError, "Git"):
            vault.restore(self.target, result["snapshot"], self.root / "new")

    def test_manifest_schema_escape_object_and_version_validation(self):
        result = self.backup()
        valid = json.loads(self.manifest_path(result).read_text())
        edits = [lambda m: m.update(version=99), lambda m: m.update(extra=True), lambda m: m["entries"][0].update(path="../outside"), lambda m: m["entries"][0].update(objectId="../../outside"), lambda m: m["entries"].append(copy.deepcopy(m["entries"][0]))]
        for edit in edits:
            value = copy.deepcopy(valid)
            edit(value)
            with self.assertRaises(vault.VaultError):
                vault.validate_manifest(value)
        with self.assertRaises(vault.VaultError):
            vault.verify(self.target, "../escape")

    def test_manifest_symlink_escape_and_parent_symlink_refused(self):
        result = self.backup()
        manifest = json.loads(self.manifest_path(result).read_text())
        manifest["entries"].append({"alias": "art", "kind": "symlink", "path": "evil", "target": "../outside"})
        with self.assertRaises(vault.VaultError):
            vault.validate_manifest(manifest)
        manifest["entries"][-1]["target"] = "a.bin"
        manifest["entries"].append({"alias": "art", "kind": "directory", "path": "evil/child"})
        with self.assertRaisesRegex(vault.VaultError, "parent"):
            vault.validate_manifest(manifest)

    def test_restore_rechecks_object_hash_and_keeps_failure_diagnostic(self):
        result = self.backup()
        self.object_path(result).write_bytes(b"corrupted")
        dest = self.root / "restore-fail"
        with self.assertRaisesRegex(vault.VaultError, "SHA"):
            vault.restore(self.target, result["snapshot"], dest)
        self.assertIn('"state": "failed"', (dest / "restore-log.jsonl").read_text())
        self.assertFalse((dest / "art/a.bin").exists())

    def test_restore_copy_is_verified_and_never_overwrites_failed_destination(self):
        result = self.backup()
        original = vault.copy_source
        def corrupt(source, dest, expected):
            value = original(source, dest, expected)
            dest.write_bytes(b"wrong copy")
            return value
        dest = self.root / "restore-fail"
        with mock.patch.object(vault, "copy_source", side_effect=corrupt):
            with self.assertRaisesRegex(vault.VaultError, "restore copy SHA"):
                vault.restore(self.target, result["snapshot"], dest)
        with self.assertRaisesRegex(vault.VaultError, "must be new"):
            vault.restore(self.target, result["snapshot"], dest)
        self.assertEqual((dest / "art/a.bin").read_bytes(), b"wrong copy")
        self.assertTrue(vault.restore(self.target, result["snapshot"], self.root / "retry")["restored"])

    def test_source_directory_cross_device_refused(self):
        original = Path.lstat
        def changed(path):
            info = original(path)
            if path == self.source.resolve() / "empty":
                return types.SimpleNamespace(st_dev=info.st_dev + 1, st_mode=info.st_mode)
            return info
        with mock.patch.object(Path, "lstat", changed):
            with self.assertRaisesRegex(vault.VaultError, "crosses volume"):
                self.backup()

    def test_copy_permission_failure_preserves_partial_and_failure_log(self):
        with mock.patch.object(vault, "copy_source", side_effect=PermissionError("read-only disk")):
            with self.assertRaises(PermissionError):
                self.backup()
        self.assert_no_published()
        self.assertIn("read-only disk", next((self.target / "logs").iterdir()).read_text())

    def test_regular_reader_refuses_fifo_and_object_symlink(self):
        result = self.backup()
        data = self.object_path(result)
        data.unlink()
        if hasattr(os, "mkfifo"):
            os.mkfifo(data)
            with self.assertRaisesRegex(vault.VaultError, "regular"):
                vault.verify(self.target, result["snapshot"])
            data.unlink()
        os.symlink(self.source / "a.bin", data)
        with self.assertRaisesRegex(vault.VaultError, "regular"):
            vault.verify(self.target, result["snapshot"])

    def test_cli_defaults_backup_to_dry_run_and_restore_needs_apply(self):
        with mock.patch("sys.stdout"), mock.patch("sys.stderr"):
            self.assertEqual(vault.main(["backup", "--source", "art=" + str(self.source), "--target", str(self.target), "--reserve-bytes", "0"]), 0)
            self.assertEqual(vault.main(["restore", "--snapshot", "a" * 32, "--target", str(self.target), "--destination", str(self.root / "restore")]), 2)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_new_source_entry_during_backup_refuses_snapshot(self):
        original = vault.copy_source
        def changed(source, dest, expected):
            result = original(source, dest, expected)
            (self.source / "appeared.bin").write_bytes(b"new")
            return result
        with mock.patch.object(vault, "copy_source", side_effect=changed):
            with self.assertRaisesRegex(vault.VaultError, "source changed"):
                self.backup()
        self.assert_no_published()

    def test_duplicate_json_fields_and_boolean_versions_refused(self):
        file = self.root / "invalid.json"
        file.write_text('{"version":1,"version":2}')
        with self.assertRaisesRegex(vault.VaultError, "duplicate"):
            vault.read_json(file)
        result = self.backup()
        manifest = json.loads(self.manifest_path(result).read_text())
        manifest["version"] = True
        with self.assertRaises(vault.VaultError):
            vault.validate_manifest(manifest)

    def test_manifest_casefold_and_nfc_collisions_on_every_filesystem(self):
        result = self.backup()
        base = json.loads(self.manifest_path(result).read_text())
        for first, second in [("ART", "art"), ("é", "e\u0301")]:
            manifest = copy.deepcopy(base)
            manifest["entries"] = [{"alias":"art", "path": first, "kind":"directory"}, {"alias":"art", "path": second, "kind":"directory"}]
            with self.assertRaises(vault.VaultError):
                vault.validate_manifest(manifest)

    @unittest.skipIf(os.name != "posix" or os.geteuid() == 0, "needs non-root POSIX permissions")
    def test_real_readonly_target_refuses_without_mutating_source(self):
        before = (self.source / "a.bin").read_bytes()
        self.target.chmod(0o555)
        try:
            with self.assertRaises(PermissionError):
                self.backup()
            self.assertEqual(list(self.target.iterdir()), [])
            self.assertEqual((self.source / "a.bin").read_bytes(), before)
        finally:
            self.target.chmod(0o755)

    def test_incomplete_snapshot_is_never_readable(self):
        with mock.patch.object(vault, "copy_source", side_effect=OSError("stop")):
            with self.assertRaises(OSError):
                self.backup()
        incomplete = next((self.target / "snapshots").iterdir()).name
        with self.assertRaises(FileNotFoundError):
            vault.verify(self.target, incomplete)

    def test_exclusive_publication_does_not_overwrite_existing_files(self):
        path = self.root / "existing.json"
        path.write_bytes(b"user data")
        with self.assertRaises(FileExistsError):
            vault.exclusive_json(path, {"version":1})
        self.assertEqual(path.read_bytes(), b"user data")

    def test_alias_cannot_create_git_metadata_or_shadow_restore_diagnostic(self):
        for alias in [".git", ".GIT", "restore-log.jsonl"]:
            with self.assertRaisesRegex(vault.VaultError, "reserved"):
                vault.plan({alias:self.source}, self.target, reserve_bytes=0)

    def test_restore_low_capacity_refuses_before_creating_destination(self):
        result = self.backup()
        dest = self.root / "no-space"
        with self.assertRaisesRegex(vault.VaultError, "capacity"):
            vault.restore(self.target, result["snapshot"], dest, reserve_bytes=0, free_bytes=0)
        self.assertFalse(dest.exists())

    def test_restore_capacity_drop_keeps_failed_record(self):
        result = self.backup()
        dest = self.root / "space-dropped"
        with mock.patch.object(vault.shutil, "disk_usage", side_effect=[types.SimpleNamespace(free=10**9), types.SimpleNamespace(free=0)]):
            with self.assertRaisesRegex(vault.VaultError, "capacity"):
                vault.restore(self.target, result["snapshot"], dest, reserve_bytes=0)
        self.assertIn('"state": "failed"', (dest / "restore-log.jsonl").read_text())
        self.assertFalse((dest / "art/a.bin").exists())

    def test_restore_detects_cross_volume_alias_ancestor(self):
        result = self.backup()
        dest = self.root.resolve() / "cross-volume"
        original = Path.lstat
        def switched(path):
            info = original(path)
            if path == dest / "art":
                return types.SimpleNamespace(st_mode=info.st_mode, st_dev=info.st_dev + 1)
            return info
        with mock.patch.object(Path, "lstat", switched):
            with self.assertRaisesRegex(vault.VaultError, "crosses volume"):
                vault.restore(self.target, result["snapshot"], dest, reserve_bytes=0)
        self.assertIn('"state": "failed"', (dest / "restore-log.jsonl").read_text())

    def test_restore_detects_parent_replacement_during_capacity_check(self):
        result = self.backup()
        parent = self.root / "restore-parent"
        parent.mkdir()
        dest = parent / "restore"
        old = self.root / "old-parent"
        actual_usage = vault.shutil.disk_usage
        def changed(path):
            value = actual_usage(path)
            parent.rename(old)
            parent.mkdir()
            return value
        with mock.patch.object(vault.shutil, "disk_usage", side_effect=changed):
            with self.assertRaisesRegex(vault.VaultError, "target root"):
                vault.restore(self.target, result["snapshot"], dest, reserve_bytes=0)
        self.assertEqual(list(parent.iterdir()), [])
        self.assertFalse((old / "restore").exists())

    def test_non_nfc_source_name_refused_without_silent_renaming(self):
        source = self.root / "non-nfc"
        source.mkdir()
        (source / "e\u0301.bin").write_bytes(b"name referenced by gltf")
        with self.assertRaisesRegex(vault.VaultError, "NFC"):
            vault.plan({"art":source}, self.target, reserve_bytes=0)
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertEqual(next(source.iterdir()).read_bytes(), b"name referenced by gltf")

    def test_restore_capacity_drops_after_first_copy_preserves_it_and_reports_failure(self):
        (self.source / "b.bin").write_bytes(b"second file")
        result = self.backup()
        dest = self.root / "partially-restored"
        usage = [types.SimpleNamespace(free=10**9), types.SimpleNamespace(free=10**9), types.SimpleNamespace(free=0)]
        with mock.patch.object(vault.shutil, "disk_usage", side_effect=usage):
            with self.assertRaisesRegex(vault.VaultError, "capacity"):
                vault.restore(self.target, result["snapshot"], dest, reserve_bytes=0)
        self.assertEqual((dest / "art/a.bin").read_bytes(), b"synthetic art bytes")
        self.assertFalse((dest / "art/b.bin").exists())
        diagnostic = (dest / "restore-log.jsonl").read_text()
        self.assertIn('"state": "restored"', diagnostic)
        self.assertIn('"state": "failed"', diagnostic)

    @unittest.skipUnless(hasattr(os, "symlink"), "no symlink support")
    def test_alias_chain_rejected_in_plan_without_writes(self):
        (self.source / "v1").write_bytes(b"v1")
        os.symlink("v1", self.source / "current")
        os.symlink("current", self.source / "consumer")
        with self.assertRaisesRegex(vault.VaultError, "chain"):
            vault.plan(self.sources, self.target, reserve_bytes=0)
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertEqual(os.readlink(self.source / "consumer"), "current")

    @unittest.skipUnless(hasattr(os, "symlink"), "no symlink support")
    def test_target_through_directory_alias_rejected_without_writes(self):
        directory = self.source / "real"
        directory.mkdir()
        (directory / "file").write_bytes(b"inside")
        os.symlink("real", self.source / "dirAlias")
        os.symlink("dirAlias/file", self.source / "consumer")
        with self.assertRaisesRegex(vault.VaultError, "chain"):
            vault.plan(self.sources, self.target, reserve_bytes=0)
        self.assertEqual(list(self.target.iterdir()), [])

    @unittest.skipUnless(hasattr(os, "symlink"), "no symlink support")
    def test_direct_relative_link_text_is_preserved_exactly(self):
        (self.source / "v1").write_bytes(b"first version")
        os.symlink("./v1", self.source / "current")
        result = self.backup()
        manifest = json.loads(self.manifest_path(result).read_text())
        row = next(e for e in manifest["entries"] if e["path"] == "current")
        self.assertEqual(row["target"], "./v1")
        destination = self.root / "restore-raw-link"
        vault.restore(self.target, result["snapshot"], destination, reserve_bytes=0)
        self.assertEqual(os.readlink(destination / "art/current"), "./v1")
        self.assertEqual((destination / "art/current").read_bytes(), b"first version")
        self.assertEqual(os.readlink(self.source / "current"), "./v1")


if __name__ == "__main__":
    unittest.main()
