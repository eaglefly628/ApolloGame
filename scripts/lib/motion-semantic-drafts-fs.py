"""Internal fixed-dirfd transaction bridge. No asset/credential access or recovery policy.
Requires POSIX Python 3 dir_fd, O_NOFOLLOW and directory flock support; Windows is unsupported.
Containment is descriptor-relative. Serialization covers cooperating writers using this lock.
POSIX has no conditional-inode replace: a same-UID attacker ignoring the lock can race the
last head verification and rename. This is not an authenticated anti-tampering store.
The Node validator remains the single owner of semantic and hash-chain rules.
"""
import os
import sys
import stat
import json
import fcntl
import errno
import subprocess

CATALOG_LIMIT = 32 * 1024 * 1024
LOG_LIMIT = 8 * 1024 * 1024
IPC_LIMIT = 128 * 1024 * 1024
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def require(condition, message):
    if not condition:
        raise RuntimeError('semantic drafts: ' + message)


def fingerprint(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns, info.st_nlink)


def identity(info):
    return (info.st_dev, info.st_ino)


def entry(parent, name):
    try:
        return os.stat(name, dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError:
        return None


class Transaction:
    def __init__(self, path, append):
        require(isinstance(path, str) and os.path.isabs(path), 'absolute library required')
        self.fds = []
        self.chain = []
        self.refs = {}
        self.append = append
        self.side = None
        self.locked = False
        self.root = self.keep(os.open('/', DIR_FLAGS))
        for component in os.path.normpath(path).split('/')[1:]:
            parent = self.root
            self.root = self.keep(os.open(component, DIR_FLAGS, dir_fd=parent))
            self.chain.append((parent, component, self.root))
        self.assert_structure()
        try:
            fcntl.flock(self.root, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('semantic drafts: library transaction lock busy')
        self.locked = True
        self.assert_structure()
        side_info = entry(self.root, 'semantic-review')
        if side_info is not None:
            self.side = self.keep(os.open('semantic-review', DIR_FLAGS, dir_fd=self.root))
        self.assert_structure()

    def keep(self, fd):
        self.fds.append(fd)
        return fd

    def assert_structure(self):
        for parent, name, fd in self.chain:
            current = entry(parent, name)
            require(current is not None and stat.S_ISDIR(current.st_mode) and identity(current) == identity(os.fstat(fd)), 'library directory changed')
        require(entry(self.root, '.semantic-drafts.lock') is None, 'existing legacy lock; preserve for operator review')
        if self.side is not None:
            current = entry(self.root, 'semantic-review')
            require(current is not None and stat.S_ISDIR(current.st_mode) and identity(current) == identity(os.fstat(self.side)), 'sidecar directory changed')

    def read_bytes(self, fd, limit):
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_size <= limit, 'file byte budget or nonregular file')
        os.lseek(fd, 0, os.SEEK_SET)
        chunks, total = [], 0
        while True:
            part = os.read(fd, min(65536, limit + 1 - total))
            if not part:
                break
            chunks.append(part)
            total += len(part)
            require(total <= limit, 'file byte budget')
        result = b''.join(chunks)
        require(fingerprint(before) == fingerprint(os.fstat(fd)) and len(result) == before.st_size, 'file changed while reading')
        try:
            result.decode('utf-8', errors='strict')
        except UnicodeDecodeError:
            raise RuntimeError('semantic drafts: invalid UTF-8')
        return result

    def read_ref(self, key, parent, name, limit, optional=False, linked=False):
        info = entry(parent, name)
        if optional and info is None:
            self.refs[key] = (parent, name, None, None, None, limit)
            return None
        require(info is not None and stat.S_ISREG(info.st_mode), 'unsafe nonregular file path')
        # O_NONBLOCK closes the regular-file-check -> FIFO-open blocking window.
        flags = os.O_NOFOLLOW | os.O_NONBLOCK | (os.O_RDWR | os.O_APPEND if key == 'log' and self.append else os.O_RDONLY)
        fd = self.keep(os.open(name, flags, dir_fd=parent))
        data = self.read_bytes(fd, limit)
        require(not linked or os.fstat(fd).st_nlink == 1, 'linked sidecar log/head refused')
        self.refs[key] = (parent, name, fd, fingerprint(os.fstat(fd)), data, limit)
        return data.decode('utf-8')

    def snapshot(self):
        catalog = self.read_ref('catalog', self.root, 'catalog.json', CATALOG_LIMIT)
        log = head = None
        next_present = False
        if self.side is not None:
            next_present = entry(self.side, 'head.next.json') is not None
            require(not next_present, 'interrupted head publication')
            log = self.read_ref('log', self.side, 'drafts.jsonl', LOG_LIMIT, optional=True, linked=True)
            head = self.read_ref('head', self.side, 'head.json', 4096, optional=True, linked=True)
        # Archive-only migrations have no head. Their original receipt pins the dictionary;
        # keep its inode/bytes in the same transaction snapshot instead of inferring latest.
        pin = None
        if self.side is not None and log is None and head is None:
            pin = self.read_ref('dictionary-pin', self.side, 'migration-receipt.json', CATALOG_LIMIT, optional=True, linked=True)
        self.assert_structure()
        snapshot = {'catalogText': catalog, 'logText': log, 'headText': head, 'nextPresent': next_present}
        if pin is not None:
            snapshot['dictionaryPinText'] = pin
        return snapshot

    def assert_snapshot(self, own_next=None):
        self.assert_structure()
        if self.side is None:
            require(entry(self.root, 'semantic-review') is None, 'sidecar appeared during validation')
        else:
            next_info = entry(self.side, 'head.next.json')
            if own_next is None:
                require(next_info is None, 'interrupted head publication')
            else:
                require(next_info is not None and stat.S_ISREG(next_info.st_mode) and identity(next_info) == identity(os.fstat(own_next)), 'head.next inode replaced')
        for parent, name, fd, info, data, limit in self.refs.values():
            current = entry(parent, name)
            if fd is None:
                require(current is None, 'snapshot file appeared during validation')
            else:
                require(current is not None and stat.S_ISREG(current.st_mode) and fingerprint(current) == info, 'snapshot file changed during validation')
                require(fingerprint(os.fstat(fd)) == info and self.read_bytes(fd, limit) == data, 'snapshot bytes changed during validation')

    def write_all(self, fd, data):
        offset = 0
        while offset < len(data):
            count = os.write(fd, data[offset:])
            require(count > 0, 'zero append/head write')
            offset += count
        os.fsync(fd)

    def commit(self, plan):
        self.assert_snapshot()
        if self.side is None:
            os.mkdir('semantic-review', mode=0o700, dir_fd=self.root)
            self.side = self.keep(os.open('semantic-review', DIR_FLAGS, dir_fd=self.root))
            os.fsync(self.root)
        self.assert_structure()
        log_ref = self.refs.get('log')
        if log_ref is not None and log_ref[2] is not None:
            log_fd = log_ref[2]  # The same inode read and validated, never reopened by pathname.
        else:
            log_fd = self.keep(os.open('drafts.jsonl', os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_APPEND | os.O_NOFOLLOW, 0o600, dir_fd=self.side))
        require(os.fstat(log_fd).st_nlink == 1, 'linked sidecar log refused')
        self.assert_structure()
        line = plan['eventLine'].encode('utf-8')
        require(len(line) <= 16384 and os.fstat(log_fd).st_size + len(line) <= LOG_LIMIT, 'append byte budget')
        old_log = log_ref[4] if log_ref is not None and log_ref[4] is not None else b''
        self.write_all(log_fd, line)
        os.fsync(self.side)
        self.refs['log'] = (self.side, 'drafts.jsonl', log_fd, fingerprint(os.fstat(log_fd)), old_log + line, LOG_LIMIT)
        if 'head' not in self.refs:
            self.refs['head'] = (self.side, 'head.json', None, None, None, 4096)
        # Recheck the entire expected log, original head, and catalog, not only inode identity.
        self.assert_snapshot()
        current_log = entry(self.side, 'drafts.jsonl')
        require(current_log is not None and identity(current_log) == identity(os.fstat(log_fd)), 'log entry replaced after append')
        next_fd = self.keep(os.open('head.next.json', os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_NOFOLLOW, 0o600, dir_fd=self.side))
        head = plan['headText'].encode('utf-8')
        require(len(head) <= 4096, 'head byte budget')
        self.write_all(next_fd, head)
        require(self.read_bytes(next_fd, 4096) == head, 'head.next bytes changed before publication')
        self.assert_snapshot(own_next=next_fd)
        require(identity(entry(self.side, 'head.next.json')) == identity(os.fstat(next_fd)), 'head.next inode replaced')
        os.replace('head.next.json', 'head.json', src_dir_fd=self.side, dst_dir_fd=self.side)
        os.fsync(self.side)
        self.refs['head'] = (self.side, 'head.json', next_fd, fingerprint(os.fstat(next_fd)), head, 4096)
        self.assert_snapshot()
        require(identity(entry(self.side, 'head.json')) == identity(os.fstat(next_fd)), 'published head inode replaced')

    def close(self):
        # Directory flock belongs to this open descriptor; never unlink a lock pathname.
        if self.locked:
            fcntl.flock(self.root, fcntl.LOCK_UN)
            self.locked = False
        for fd in reversed(self.fds):
            os.close(fd)
        self.fds = []


def main():
    raw = sys.stdin.buffer.read(32769)
    require(len(raw) <= 32768, 'internal request byte budget')
    request = json.loads(raw)
    require(request.get('protocolVersion') == 1 and request.get('action') in ('read', 'append'), 'internal protocol mismatch')
    transaction = None
    try:
        # Ensure even constructor/open failures close descriptors without touching foreign locks.
        transaction = Transaction.__new__(Transaction)
        transaction.fds, transaction.locked = [], False
        Transaction.__init__(transaction, request['lib'], request['action'] == 'append')
        snapshot = transaction.snapshot()
        validator = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'motion-semantic-drafts-validate.mjs')
        payload = json.dumps({'action': request['action'], 'request': request.get('request'), 'snapshot': snapshot,
                              **({'dictionaryVersion': request['dictionaryVersion']} if 'dictionaryVersion' in request else {})}, ensure_ascii=False).encode('utf-8')
        require(len(payload) <= IPC_LIMIT, 'internal snapshot byte budget')
        process = subprocess.run([request['nodeExecutable'], validator], input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        require(process.returncode == 0, process.stderr.decode('utf-8', errors='replace')[:4096] or 'semantic validation failed')
        require(len(process.stdout) <= 96 * 1024 * 1024, 'internal result byte budget')
        result = json.loads(process.stdout)
        transaction.assert_snapshot()
        if result['commit'] is not None:
            transaction.commit(result['commit'])
        output = json.dumps(result['result'], ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        require(len(output) <= 96 * 1024 * 1024, 'public output byte budget')
        sys.stdout.buffer.write(output)
    finally:
        if transaction is not None:
            transaction.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        prefix = 'unsafe filesystem path: ' if isinstance(error, OSError) and error.errno in (errno.ELOOP, errno.ENOTDIR) else ''
        sys.stderr.write('semantic drafts: ' + prefix + str(error) + '\n')
        sys.exit(2)
