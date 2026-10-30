"""Draft-only, two-library migration. Fixed dirfds/flock; no asset reads or recovery.
The Node validator owns all semantic rules. Cooperating writers use directory locks;
this is not an authenticated store against a same-UID actor ignoring those locks.
A no-replace atomic directory rename prevents clobbering an appeared destination.
"""
import os
import sys
import json
import stat
import errno
import ctypes
import subprocess
import importlib.util

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('semantic_draft_fs', os.path.join(HERE, 'motion-semantic-drafts-fs.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
Transaction, require, entry = base.Transaction, base.require, base.entry
STAGING = '.semantic-review.migration-staging'
PUBLIC_LIMIT = 32 * 1024 * 1024
HISTORY_BYTES = 64 * 1024 * 1024
HISTORY_GENERATIONS = 8
HISTORY_FILES = 32


class MigrationTransaction(Transaction):
    def __init__(self, path, append):
        self.history_dirs = []
        self.history_bytes = 0
        self.history_files = 0
        super().__init__(path, append)

    def read_ref(self, key, parent, name, limit, optional=False, linked=False):
        # Catalogs, not only sidecar files, must be unlinked regular inputs.
        return super().read_ref(key, parent, name, limit, optional=optional, linked=True)

    def assert_structure(self):
        super().assert_structure()
        for fd, names in self.history_dirs:
            require(set(os.listdir(fd)) == names, 'migration history directory entries changed')

    def history_directory(self, parent, name):
        info = entry(parent, name)
        require(info is not None and stat.S_ISDIR(info.st_mode), 'unsafe migration history directory')
        fd = self.keep(os.open(name, base.DIR_FLAGS, dir_fd=parent))
        require(base.identity(info) == base.identity(os.fstat(fd)), 'migration history directory changed while opening')
        self.chain.append((parent, name, fd))
        return fd

    def history_listing(self, fd, allowed, required):
        names = set(os.listdir(fd))
        require(required <= names and names <= allowed, 'unexpected or incomplete migration history entries')
        self.history_dirs.append((fd, names))
        return names

    def history_file(self, parent, name, prefix, limit, optional=False):
        value = self.read_ref('history:' + prefix + name, parent, name, min(limit, HISTORY_BYTES - self.history_bytes), optional=optional)
        if value is not None:
            self.history_bytes += len(value.encode('utf-8'))
            self.history_files += 1
            require(self.history_bytes <= HISTORY_BYTES and self.history_files <= HISTORY_FILES, 'migration history total budget')
        return value

    def snapshot_history(self):
        if self.side is None:
            return None
        names = self.history_listing(self.side, {'drafts.jsonl', 'head.json', 'migration-receipt.json', 'migration-archive'}, set())
        if not ({'migration-receipt.json', 'migration-archive'} & names):
            return None
        require({'migration-receipt.json', 'migration-archive'} <= names, 'incomplete migration history')
        return self.history_node(self.side, '', 1, root=True)

    def history_node(self, parent, prefix, generation, root=False):
        require(generation <= HISTORY_GENERATIONS, 'migration history generation budget')
        if not root:
            self.history_listing(parent, {'migration-receipt.json', 'migration-archive'}, {'migration-receipt.json', 'migration-archive'})
        receipt = self.history_file(parent, 'migration-receipt.json', prefix, PUBLIC_LIMIT)
        archive = self.history_directory(parent, 'migration-archive')
        names = self.history_listing(archive, {'catalog.json', 'drafts.jsonl', 'head.json', 'parent-migration'}, {'catalog.json'})
        prefix += 'migration-archive/'
        snapshot = {'catalogText': self.history_file(archive, 'catalog.json', prefix, base.CATALOG_LIMIT),
                    'logText': self.history_file(archive, 'drafts.jsonl', prefix, base.LOG_LIMIT, optional=True),
                    'headText': self.history_file(archive, 'head.json', prefix, 4096, optional=True),
                    'nextPresent': False}
        previous = None
        if 'parent-migration' in names:
            previous = self.history_node(self.history_directory(archive, 'parent-migration'), prefix + 'parent-migration/', generation + 1)
        return {'receiptText': receipt, 'snapshot': snapshot, 'parent': previous}


def no_replace_renamer():
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == 'darwin' and hasattr(libc, 'renameatx_np'):
        fn, flag = libc.renameatx_np, 4  # RENAME_EXCL
    elif sys.platform.startswith('linux') and hasattr(libc, 'renameat2'):
        fn, flag = libc.renameat2, 1  # RENAME_NOREPLACE
    else:
        raise RuntimeError('semantic migration: atomic no-replace directory rename unsupported')
    fn.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    fn.restype = ctypes.c_int

    def rename(source_fd, source_name, target_fd, target_name):
        if fn(source_fd, os.fsencode(source_name), target_fd, os.fsencode(target_name), flag) != 0:
            number = ctypes.get_errno()
            raise OSError(number, os.strerror(number))
    return rename


def assert_destination(target):
    target.assert_structure()
    require(entry(target.root, 'semantic-review') is None, 'migration target sidecar already exists; preserve for operator review')
    # Keep failed stages as evidence. Never guess which orphan is safe to remove.
    require(not any(name.startswith('.semantic-review.migration-') for name in os.listdir(target.root)), 'migration staging exists; preserve for operator review')


def commit(source, target, source_snapshot, source_history, plan):
    rename = no_replace_renamer()  # Capability refusal occurs before creating any staging data.
    source.assert_snapshot()
    target.assert_snapshot()
    assert_destination(target)
    os.mkdir(STAGING, mode=0o700, dir_fd=target.root)
    stage = target.keep(os.open(STAGING, base.DIR_FLAGS, dir_fd=target.root))
    os.fsync(target.root)
    directories = [(target.root, STAGING, stage)]
    contents = {stage: set()}
    written = []

    def directory(parent, name):
        os.mkdir(name, mode=0o700, dir_fd=parent)
        fd = target.keep(os.open(name, base.DIR_FLAGS, dir_fd=parent))
        directories.append((parent, name, fd))
        contents[parent].add(name)
        contents[fd] = set()
        return fd

    def write(parent, name, text, limit):
        data = text.encode('utf-8')
        require(len(data) <= limit, 'migration output byte budget')
        fd = target.keep(os.open(name, os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_NOFOLLOW, 0o600, dir_fd=parent))
        target.write_all(fd, data)
        written.append((parent, name, fd, base.fingerprint(os.fstat(fd)), data, limit))
        contents[parent].add(name)

    def archive_snapshot(parent, snapshot, history):
        for key, name, limit in [('catalogText', 'catalog.json', base.CATALOG_LIMIT), ('logText', 'drafts.jsonl', base.LOG_LIMIT), ('headText', 'head.json', 4096)]:
            if snapshot[key] is not None:
                write(parent, name, snapshot[key], limit)
        if history is not None:
            inherited = directory(parent, 'parent-migration')
            write(inherited, 'migration-receipt.json', history['receiptText'], PUBLIC_LIMIT)
            archive_snapshot(directory(inherited, 'migration-archive'), history['snapshot'], history['parent'])

    archive_snapshot(directory(stage, 'migration-archive'), source_snapshot, source_history)
    if plan['logText'] is not None:
        write(stage, 'drafts.jsonl', plan['logText'], base.LOG_LIMIT)
        write(stage, 'head.json', plan['headText'], 4096)
    write(stage, 'migration-receipt.json', plan['receiptText'], PUBLIC_LIMIT)
    # Bottom-up directory durability after all individual file fsyncs.
    for _, _, fd in reversed(directories):
        os.fsync(fd)

    def assert_outputs(published=False):
        for parent, name, fd in directories:
            if fd == stage:
                name = 'semantic-review' if published else STAGING
            info = entry(parent, name)
            require(info is not None and stat.S_ISDIR(info.st_mode) and base.identity(info) == base.identity(os.fstat(fd)), 'migration staging directory changed')
            require(set(os.listdir(fd)) == contents[fd], 'unexpected migration staged entry')
        for parent, name, fd, before, data, limit in written:
            now = entry(parent, name)
            require(now is not None and stat.S_ISREG(now.st_mode) and now.st_nlink == 1 and base.fingerprint(now) == before, 'migration staged file changed')
            require(target.read_bytes(fd, limit) == data and base.fingerprint(os.fstat(fd)) == before, 'migration staged bytes changed')

    assert_outputs()
    source.assert_snapshot()
    target.assert_snapshot()
    require(entry(target.root, 'semantic-review') is None, 'migration target sidecar appeared')
    rename(target.root, STAGING, target.root, 'semantic-review')
    target.side = stage  # Subsequent checks now expect our published directory, on the same fd.
    os.fsync(target.root)
    target.assert_snapshot()
    source.assert_snapshot()
    assert_outputs(published=True)


def main():
    raw = sys.stdin.buffer.read(32769)
    require(len(raw) <= 32768, 'migration request byte budget')
    request = json.loads(raw)
    require(isinstance(request, dict) and set(request) == {'protocolVersion', 'sourceLib', 'targetLib', 'nodeExecutable', 'apply', 'expected'}, 'migration protocol fields')
    require(request['protocolVersion'] == 1 and type(request['apply']) is bool, 'migration protocol mismatch')
    source_path, target_path = request['sourceLib'], request['targetLib']
    require(all(isinstance(path, str) and os.path.isabs(path) and os.path.normpath(path) == path for path in [source_path, target_path]), 'migration canonical absolute libraries required')
    common = os.path.commonpath([source_path, target_path])
    require(common not in (source_path, target_path), 'migration libraries must be disjoint, not same or ancestor')
    require(not request['apply'] or isinstance(request['expected'], dict), 'migration apply requires expected binding')
    transactions = []
    try:
        # Consistent lock acquisition plus nonblocking flock: never wait while holding another library.
        by_path = {}
        for path in sorted([source_path, target_path]):
            transaction = MigrationTransaction.__new__(MigrationTransaction)
            transaction.fds, transaction.locked = [], False
            transactions.append(transaction)
            MigrationTransaction.__init__(transaction, path, False)
            by_path[path] = transaction
        source, target = by_path[source_path], by_path[target_path]
        # Compare physical directory ancestry, including case/alternate spellings of the same inode.
        # These are the already pinned traversal FDs, not another realpath/open race.
        def ancestors(transaction):
            return {base.identity(os.fstat(fd)) for parent, _, child in transaction.chain for fd in (parent, child)} | {base.identity(os.fstat(transaction.root))}
        require(base.identity(os.fstat(source.root)) not in ancestors(target) and base.identity(os.fstat(target.root)) not in ancestors(source), 'migration libraries must be physically disjoint, not same or ancestor')
        assert_destination(target)
        source_snapshot, target_snapshot = source.snapshot(), target.snapshot()
        source_history = source.snapshot_history()
        payload = json.dumps({'action': 'migrate', 'sourceSnapshot': source_snapshot, 'targetSnapshot': target_snapshot, 'sourceHistory': source_history, 'expected': request['expected']}, ensure_ascii=False).encode('utf-8')
        require(len(payload) <= base.IPC_LIMIT, 'migration snapshot byte budget')
        process = subprocess.run([request['nodeExecutable'], os.path.join(HERE, 'motion-semantic-drafts-validate.mjs')], input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        require(process.returncode == 0, process.stderr.decode('utf-8', errors='replace')[:4096] or 'migration semantic validation failed')
        require(len(process.stdout) <= 96 * 1024 * 1024, 'migration validator result byte budget')
        result = json.loads(process.stdout)
        source.assert_snapshot()
        target.assert_snapshot()
        assert_destination(target)
        output = {**result['result'], 'mode': 'applied' if request['apply'] else 'dry-run'}
        encoded = json.dumps(output, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        require(len(encoded) <= PUBLIC_LIMIT, 'migration public manifest byte budget')
        if request['apply']:
            commit(source, target, source_snapshot, source_history, result['commit'])
        sys.stdout.buffer.write(encoded)
    finally:
        for transaction in reversed(transactions):
            transaction.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        prefix = 'unsafe filesystem path: ' if isinstance(error, OSError) and error.errno in (errno.ELOOP, errno.ENOTDIR) else ''
        sys.stderr.write('semantic migration: ' + prefix + str(error) + '\n')
        sys.exit(2)
