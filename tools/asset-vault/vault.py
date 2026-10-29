"""Offline asset backup, Python 3 / local filesystems only; never edits a source.

Cooperative writers only. Repeated device/inode/content checks detect ordinary
changes/disconnects, not malicious same-UID races between check and filesystem IO.
No automatic stale-lock cleanup, resume after unplug, ACL/xattr/ownership copy,
sparse preservation, hardware power-loss durability, or universal symlink creation
is promised. File fsync is used; directory/hardware flush support varies by volume.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import unicodedata
import uuid

VERSION = 1
MARKER = {"schema": "apollo-asset-vault", "version": VERSION}
MAX_ENTRIES = 100000
MAX_JSON = 32 * 1024 * 1024
RESERVE = 64 * 1024 * 1024
CHUNK = 1024 * 1024
SHA = re.compile(r"^[0-9a-f]{64}$")
UID = re.compile(r"^[0-9a-f]{32}$")
RESERVED = re.compile(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$", re.I)


class VaultError(Exception):
    pass


def require(ok, message):
    if not ok:
        raise VaultError(message)


def fingerprint(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns)


def part(name):
    require(isinstance(name, str) and name not in ("", ".", ".."), "invalid path component")
    value = unicodedata.normalize("NFC", name)
    require(len(value.encode("utf-8")) <= 240 and not re.search(r'[<>:"/\\|?*\x00-\x1f\x7f]', value)
            and not value.endswith((" ", ".")) and not RESERVED.fullmatch(value), "nonportable path component")
    return value


def relpath(value):
    require(isinstance(value, str) and len(value) <= 4096, "invalid relative path")
    path = PurePosixPath(value)
    require(not path.is_absolute() and value == path.as_posix() and value != ".", "path escape or noncanonical path")
    require(all(part(p) == p for p in path.parts), "noncanonical path component")
    return path


def under(path, root):
    return path == root or root in path.parents


def regular(path, limit=None):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode), "expected regular file: " + str(path))
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    fd = os.open(path, flags)
    try:
        require(fingerprint(os.fstat(fd)) == fingerprint(info), "file changed during open")
        if limit is not None:
            require(info.st_size <= limit, "JSON read budget exceeded")
        return fd, info
    except BaseException:
        os.close(fd)
        raise


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "duplicate JSON field")
        value[key] = item
    return value


def read_json(path):
    fd, info = regular(path, MAX_JSON)
    with os.fdopen(fd, "rb") as stream:
        data = stream.read(MAX_JSON + 1)
        require(len(data) <= MAX_JSON and fingerprint(os.fstat(stream.fileno())) == fingerprint(info), "JSON changed during read")
    try:
        return json.loads(data, object_pairs_hook=unique_object, parse_constant=lambda _: (_ for _ in ()).throw(VaultError("nonfinite JSON value")))
    except (ValueError, UnicodeError) as error:
        raise VaultError("invalid JSON: " + str(path)) from error


def exclusive_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
    require(len(data) <= MAX_JSON, "JSON write budget exceeded")
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def hash_file(path, expected=None):
    fd, info = regular(path)
    digest = hashlib.sha256()
    with os.fdopen(fd, "rb") as stream:
        if expected is not None:
            require(fingerprint(info) == expected, "source changed before hashing")
        while True:
            chunk = stream.read(CHUNK)
            if not chunk:
                break
            digest.update(chunk)
        require(fingerprint(os.fstat(stream.fileno())) == fingerprint(info), "file changed while hashing")
    require(fingerprint(path.lstat()) == fingerprint(info), "file path changed while hashing")
    return digest.hexdigest(), info.st_size


def outside_git(path):
    for ancestor in (path, *path.parents):
        require(not os.path.lexists(ancestor / ".git"), "destination inside Git repository refused")


def root_identity(root):
    info = root.lstat()
    require(stat.S_ISDIR(info.st_mode), "root must be existing real directory")
    return info.st_dev, info.st_ino


class Target:
    def __init__(self, path):
        self.path = Path(path).absolute()
        self.identity = root_identity(self.path)
        self.path = self.path.resolve(strict=True)
        outside_git(self.path)
        require(root_identity(self.path) == self.identity, "target root changed")

    def check(self):
        require(root_identity(self.path) == self.identity, "target root/device/inode changed or disconnected")

    def directory(self, path):
        self.check()
        identity = root_identity(path)
        require(identity[0] == self.identity[0], "target crosses volume")
        return path

    def existing(self):
        self.check()
        entries = set(os.listdir(self.path))
        if not entries:
            return False
        require("vault.json" in entries, "nonempty unknown target refused")
        marker = read_json(self.path / "vault.json")
        require(marker == MARKER and type(marker.get("version")) is int, "unknown vault version/marker")
        require(entries <= {"vault.json", "objects", "snapshots", "logs", ".write-lock"}, "unknown target content")
        for name in ("objects", "snapshots", "logs"):
            self.directory(self.path / name)
        return True


def scan_sources(sources, target):
    require(isinstance(sources, dict) and sources, "explicit source aliases required")
    roots, entries, seen_aliases = {}, [], set()
    for alias, raw in sources.items():
        normalized = part(alias)
        require(alias.casefold() not in (".git", "restore-log.jsonl"), "reserved source alias")
        require(normalized == alias and alias.casefold() not in seen_aliases, "alias normalization/case collision")
        seen_aliases.add(alias.casefold())
        path = Path(raw).absolute()
        root_identity(path)
        require(path.name.casefold() != ".git", "source is Git metadata")
        roots[alias] = path.resolve(strict=True)
    all_roots = list(roots.values())
    for index, source in enumerate(all_roots):
        require(not under(source, target.path) and not under(target.path, source), "source/target overlap")
        for other in all_roots[index + 1:]:
            require(not under(source, other) and not under(other, source), "overlapping sources")
    snapshots = {}
    for alias, root in sorted(roots.items()):
        device = root.stat().st_dev
        alias_entries = []

        def walk(directory, relative):
            info = directory.lstat()
            require(stat.S_ISDIR(info.st_mode) and info.st_dev == device, "source directory changed or crosses volume")
            snapshots[str(directory)] = fingerprint(info)
            siblings = set()
            for child in sorted(directory.iterdir(), key=lambda p: p.name):
                require(child.name.casefold() != ".git", "source contains Git metadata")
                canonical = part(child.name)
                require(canonical == child.name, "source name must already be NFC; rename/review separately")
                require(canonical.casefold() not in siblings, "NFC/casefold relative name collision")
                siblings.add(canonical.casefold())
                local = relative + [canonical]
                original_info = child.lstat()
                require(original_info.st_dev == device, "source crosses volume")
                snapshots[str(child)] = fingerprint(original_info)
                entry = {"alias": alias, "path": "/".join(local), "_source": child,
                         "_fingerprint": fingerprint(original_info)}
                if stat.S_ISDIR(original_info.st_mode):
                    entry["kind"] = "directory"
                    alias_entries.append(entry)
                    walk(child, local)
                elif stat.S_ISREG(original_info.st_mode):
                    entry.update(kind="file", size=original_info.st_size)
                    alias_entries.append(entry)
                elif stat.S_ISLNK(original_info.st_mode):
                    raw_target = os.readlink(child)
                    require(not os.path.isabs(raw_target), "absolute source symlink refused")
                    entry.update(kind="symlink", target=raw_target)
                    alias_entries.append(entry)
                else:
                    raise VaultError("source special file refused")
                require(len(alias_entries) + len(entries) <= MAX_ENTRIES, "entry budget exceeded")
        walk(root, [])
        kinds = {"": "directory", **{e["path"]: e["kind"] for e in alias_entries}}
        for entry in alias_entries:
            if entry["kind"] == "symlink":
                validate_link_target(entry["path"], entry["target"], kinds)
        entries.extend(alias_entries)
    return roots, entries, snapshots


def validate_link_target(link_path, raw_target, kinds):
    """Preserve raw link text; accept only direct concrete in-alias targets.

    No chain flattening: a symlink encountered even before a later '..' refuses.
    All intermediate components must already be concrete planned directories.
    """
    require(isinstance(raw_target, str) and raw_target and len(raw_target) <= 4096
            and not PurePosixPath(raw_target).is_absolute(), "invalid symlink target")
    components = list(PurePosixPath(link_path).parent.parts)
    pieces = raw_target.split("/")
    for index, component in enumerate(pieces):
        if component == ".":
            continue
        if component == "..":
            require(components, "symlink escape")
            components.pop()
        else:
            require(part(component) == component, "invalid symlink component")
            components.append(component)
        key = "/".join(components)
        require(kinds.get(key) in ("file", "directory"), "symlink chain or unavailable target refused")
        if index < len(pieces) - 1:
            require(kinds.get(key) == "directory", "symlink target ancestor not concrete directory")
    result = "/".join(components)
    require(result != link_path and kinds.get(result) in ("file", "directory"),
            "symlink target must be concrete internal entry")
    return result


def check_sources(snapshots):
    for path, expected in snapshots.items():
        require(fingerprint(Path(path).lstat()) == expected, "source changed during backup")


def capacity(target, amount, reserve_bytes, free_bytes=None):
    require(type(reserve_bytes) is int and reserve_bytes >= 0, "invalid capacity reserve")
    target.check()
    free = shutil.disk_usage(target.path).free if free_bytes is None else free_bytes
    require(type(free) is int and free >= 0, "invalid free capacity")
    require(free >= amount + reserve_bytes, "insufficient target capacity")
    return free


def plan(sources, target, reserve_bytes=RESERVE, free_bytes=None):
    """Read metadata only. Does not open source contents, hash, or create target files."""
    store = Target(target)
    store.existing()
    roots, entries, _ = scan_sources(sources, store)
    size = sum(e.get("size", 0) for e in entries)
    overhead = 1024 * 1024 + len(entries) * 4096
    available = capacity(store, size + overhead, reserve_bytes, free_bytes)
    return {"version": VERSION, "dryRun": True, "aliases": sorted(roots), "entries": len(entries),
            "files": sum(e["kind"] == "file" for e in entries), "sourceBytes": size,
            "worstCaseAdditionalBytes": size + overhead, "reserveBytes": reserve_bytes, "availableBytes": available}


def object_directory(store, sha, object_id):
    require(SHA.fullmatch(sha) and UID.fullmatch(object_id), "invalid object identity")
    shard = store.directory(store.path / "objects" / sha)
    return store.directory(shard / object_id)


def verified_object(store, sha, object_id, size):
    directory = object_directory(store, sha, object_id)
    completion = read_json(directory / "complete.json")
    require(completion == {"version": VERSION, "sha256": sha, "size": size} and type(completion.get("version")) is int and type(completion.get("size")) is int, "object completion mismatch")
    actual, actual_size = hash_file(directory / "data")
    store.check()
    require(actual == sha and actual_size == size, "object SHA mismatch")
    return directory / "data"


def reusable_object(store, sha, size):
    shard = store.path / "objects" / sha
    if not shard.exists():
        return None
    store.directory(shard)
    for child in sorted(shard.iterdir()):
        require(UID.fullmatch(child.name), "invalid object directory")
        store.directory(child)
        if not (child / "complete.json").exists():
            continue  # Retain incomplete copy; never overwrite it.
        verified_object(store, sha, child.name, size)
        return child.name
    return None


def copy_source(source, destination, expected):
    fd, info = regular(source)
    digest = hashlib.sha256()
    with os.fdopen(fd, "rb") as src, destination.open("xb") as dest:
        require(fingerprint(info) == expected, "source changed before copying")
        while True:
            chunk = src.read(CHUNK)
            if not chunk:
                break
            dest.write(chunk)
            digest.update(chunk)
        dest.flush()
        os.fsync(dest.fileno())
        require(fingerprint(os.fstat(src.fileno())) == expected, "source changed while copying")
    require(fingerprint(source.lstat()) == expected, "source replaced while copying")
    return digest.hexdigest()


def backup(sources, target, apply=False, reserve_bytes=RESERVE, free_bytes=None):
    planned = plan(sources, target, reserve_bytes, free_bytes)
    if not apply:
        return planned
    store = Target(target)
    roots, entries, snapshots = scan_sources(sources, store)
    if not store.existing():
        store.check()
        exclusive_json(store.path / "vault.json", MARKER)
        for name in ("objects", "snapshots", "logs"):
            store.check()
            (store.path / name).mkdir()
    store.existing()
    lock = store.path / ".write-lock"
    store.check()
    lock.mkdir()  # Existing lock is never cleared automatically.
    lock_identity = root_identity(lock)
    log = None
    snapshot_id = uuid.uuid4().hex
    try:
        store.check()
        log = (store.path / "logs" / (snapshot_id + ".jsonl")).open("x", encoding="utf-8")
        def event(state, **details):
            log.write(json.dumps({"state": state, **details}, ensure_ascii=False) + "\n")
            log.flush()
            os.fsync(log.fileno())
        event("started", snapshot=snapshot_id)
        store.directory(store.path / "snapshots")
        snapshot = store.path / "snapshots" / snapshot_id
        snapshot.mkdir()
        manifest_entries = []
        reused = copied = 0
        for source_entry in entries:
            store.check()
            entry = {key: value for key, value in source_entry.items() if not key.startswith("_")}
            if entry["kind"] == "file":
                sha, size = hash_file(source_entry["_source"], source_entry["_fingerprint"])
                object_id = reusable_object(store, sha, size)
                if object_id is None:
                    capacity(store, size + 4096, reserve_bytes, free_bytes)
                    shard = store.path / "objects" / sha
                    if not shard.exists():
                        store.check()
                        shard.mkdir()
                    store.directory(shard)
                    object_id = uuid.uuid4().hex
                    destination = shard / object_id
                    destination.mkdir()
                    store.check()
                    require(copy_source(source_entry["_source"], destination / "data", source_entry["_fingerprint"]) == sha, "copied source SHA changed")
                    store.check()
                    actual_sha, actual_size = hash_file(destination / "data")
                    store.check()
                    require(actual_sha == sha and actual_size == size, "copy SHA verification failed")
                    store.directory(destination)
                    exclusive_json(destination / "complete.json", {"version": VERSION, "sha256": sha, "size": size})
                    copied += 1
                else:
                    reused += 1
                entry.update(sha256=sha, objectId=object_id)
            manifest_entries.append(entry)
            event("entry", alias=entry["alias"], path=entry["path"], kind=entry["kind"])
        check_sources(snapshots)
        store.check()
        manifest = {"schema": "apollo-asset-snapshot", "version": VERSION, "id": snapshot_id,
                    "createdUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "sources": sorted(roots), "entries": manifest_entries}
        validate_manifest(manifest)
        store.directory(snapshot)
        event("verified", copied=copied, reused=reused)
        exclusive_json(snapshot / "complete.json", manifest)  # Last publication; no rename/overwrite.
        store.check()
        return {"version": VERSION, "dryRun": False, "snapshot": snapshot_id, "copiedObjects": copied,
                "reusedObjects": reused, "entries": len(entries)}
    except BaseException as error:
        if log:
            try:
                event("failed", error=str(error))
            except OSError:
                pass
        raise
    finally:
        if log:
            log.close()
        try:
            store.check()
            if root_identity(lock) == lock_identity:
                lock.rmdir()
        except (OSError, VaultError):
            pass  # Never delete a foreign/replaced lock or hide the original failure.


def validate_manifest(manifest):
    require(isinstance(manifest, dict) and set(manifest) == {"schema", "version", "id", "createdUtc", "sources", "entries"}, "invalid manifest schema")
    require(manifest["schema"] == "apollo-asset-snapshot" and manifest["version"] == VERSION and type(manifest["version"]) is int and isinstance(manifest["id"], str) and UID.fullmatch(manifest["id"]), "unknown manifest version/identity")
    require(isinstance(manifest["createdUtc"], str) and len(manifest["createdUtc"]) < 100, "invalid manifest date")
    aliases = manifest["sources"]
    require(isinstance(aliases, list) and aliases and all(isinstance(a, str) and part(a) == a and a.casefold() not in (".git", "restore-log.jsonl") for a in aliases), "invalid manifest aliases")
    require(len({a.casefold() for a in aliases}) == len(aliases), "manifest alias collision")
    entries = manifest["entries"]
    require(isinstance(entries, list) and len(entries) <= MAX_ENTRIES, "manifest entry budget")
    seen, kinds = set(), {}
    for entry in entries:
        require(isinstance(entry, dict) and entry.get("alias") in aliases and entry.get("kind") in ("file", "directory", "symlink"), "invalid manifest entry")
        kind = entry["kind"]
        fields = {"alias", "path", "kind"} | ({"size", "sha256", "objectId"} if kind == "file" else {"target"} if kind == "symlink" else set())
        require(set(entry) == fields, "unknown manifest entry fields")
        path = relpath(entry["path"])
        key = (entry["alias"].casefold(), entry["path"].casefold())
        require(key not in seen, "manifest relative collision")
        seen.add(key)
        kinds[(entry["alias"], entry["path"])] = kind
        if kind == "file":
            require(type(entry["size"]) is int and entry["size"] >= 0 and isinstance(entry["sha256"], str) and SHA.fullmatch(entry["sha256"]) and isinstance(entry["objectId"], str) and UID.fullmatch(entry["objectId"]), "invalid manifest object")
    for entry in entries:
        path = PurePosixPath(entry["path"])
        for parent in path.parents:
            if parent != PurePosixPath("."):
                require(kinds.get((entry["alias"], str(parent))) == "directory", "manifest parent not directory")
        if entry["kind"] == "symlink":
            alias_kinds = {"": "directory", **{path: kind for (alias, path), kind in kinds.items() if alias == entry["alias"]}}
            validate_link_target(entry["path"], entry["target"], alias_kinds)
    return manifest


def load_snapshot(store, snapshot):
    require(isinstance(snapshot, str) and UID.fullmatch(snapshot), "invalid snapshot ID")
    require(store.existing(), "vault missing")
    directory = store.directory(store.path / "snapshots" / snapshot)
    manifest = validate_manifest(read_json(directory / "complete.json"))
    require(manifest["id"] == snapshot, "snapshot identity mismatch")
    store.check()
    return manifest


def verify(target, snapshot):
    store = Target(target)
    manifest = load_snapshot(store, snapshot)
    total = 0
    for entry in manifest["entries"]:
        if entry["kind"] == "file":
            verified_object(store, entry["sha256"], entry["objectId"], entry["size"])
            total += entry["size"]
    store.check()
    return {"version": VERSION, "snapshot": snapshot, "verified": True, "bytes": total, "entries": len(manifest["entries"])}


def restore(target, snapshot, destination, reserve_bytes=RESERVE, free_bytes=None):
    store = Target(target)
    manifest = load_snapshot(store, snapshot)
    dest = Path(destination).absolute()
    require(not dest.exists() and not dest.is_symlink(), "restore destination must be new")
    parent = dest.parent.resolve(strict=True)
    require(not under(parent, store.path) and not under(store.path, parent / dest.name), "restore overlaps vault")
    dest = parent / dest.name
    outside_git(dest)
    destination_parent = Target(parent)
    expected_bytes = sum(e.get("size", 0) for e in manifest["entries"])
    overhead = 1024 * 1024 + len(manifest["entries"]) * 4096
    capacity(destination_parent, expected_bytes + overhead, reserve_bytes, free_bytes)
    destination_parent.check()
    dest.mkdir()
    dest_identity = root_identity(dest)
    require(dest_identity[0] == destination_parent.identity[0], "restore destination crosses volume")
    log = None
    try:
        log = (dest / "restore-log.jsonl").open("x", encoding="utf-8")
        def check_dest():
            destination_parent.check()
            require(root_identity(dest) == dest_identity, "restore root changed/disconnected")
        for alias in manifest["sources"]:
            require(alias.casefold() != "restore-log.jsonl", "alias conflicts with restore diagnostic")
            (dest / alias).mkdir()
        entries = sorted(manifest["entries"], key=lambda e: (e["kind"] == "symlink", len(PurePosixPath(e["path"]).parts), e["path"]))
        for entry in entries:
            store.check()
            check_dest()
            path = dest / entry["alias"] / entry["path"]
            for ancestor in path.parents:
                if ancestor == dest:
                    break
                ancestor_info = ancestor.lstat()
                require(stat.S_ISDIR(ancestor_info.st_mode) and ancestor_info.st_dev == dest_identity[0], "restore ancestor replaced or crosses volume")
            if entry["kind"] == "directory":
                path.mkdir()
            elif entry["kind"] == "symlink":
                require(hasattr(os, "symlink"), "symlink restore unsupported")
                os.symlink(entry["target"], path)
            else:
                capacity(destination_parent, entry["size"] + 4096, reserve_bytes, free_bytes)
                source = verified_object(store, entry["sha256"], entry["objectId"], entry["size"])
                expected = fingerprint(source.lstat())
                require(copy_source(source, path, expected) == entry["sha256"], "restore source SHA changed")
                require(hash_file(path) == (entry["sha256"], entry["size"]), "restore copy SHA failed")
            log.write(json.dumps({"state": "restored", "alias": entry["alias"], "path": entry["path"]}) + "\n")
            log.flush()
            os.fsync(log.fileno())
        store.check()
        check_dest()
        log.write('{"state":"complete"}\n')
        log.flush()
        os.fsync(log.fileno())
        return {"version": VERSION, "restored": True, "snapshot": snapshot, "destination": str(dest)}
    except BaseException as error:
        if log:
            try:
                log.write(json.dumps({"state": "failed", "error": str(error)}) + "\n")
                log.flush()
                os.fsync(log.fileno())
            except OSError:
                pass
        raise
    finally:
        if log:
            log.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "backup", "verify", "restore"])
    parser.add_argument("--source", action="append", default=[], metavar="ALIAS=ROOT")
    parser.add_argument("--target", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--snapshot")
    parser.add_argument("--destination")
    parser.add_argument("--reserve-bytes", type=int, default=RESERVE)
    args = parser.parse_args(argv)
    try:
        if args.command in ("plan", "backup"):
            sources = {}
            for source in args.source:
                alias, separator, root = source.partition("=")
                require(separator and alias not in sources and root, "source requires unique ALIAS=ROOT")
                sources[alias] = root
            require(args.command == "backup" or not args.apply, "plan never applies")
            result = backup(sources, args.target, apply=args.apply, reserve_bytes=args.reserve_bytes)
        elif args.command == "verify":
            require(not args.apply and not args.source and not args.destination and args.snapshot, "verify requires only target/snapshot")
            result = verify(args.target, args.snapshot)
        else:
            require(args.apply and args.snapshot and args.destination and not args.source, "restore requires --apply --snapshot --destination")
            result = restore(args.target, args.snapshot, args.destination, reserve_bytes=args.reserve_bytes)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (VaultError, OSError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
