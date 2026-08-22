<!-- source: https://palantir.com/docs/foundry/administration/container-restrictions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Container restrictions

Palantir restricts various system calls (syscalls) from running inside our infrastructure through Secure Computing Mode (seccomp). Seccomp is a security feature in the Linux kernel that allows system call (syscall) restrictions to apply to a process or container.

Seccomp filters provide a way to allowlist the syscalls that a container can make and allows for multiple methods of handling non-allowlisted syscalls, including `LOG`, `KILL`, and `ERRNO` profiles:

* `LOG` allows non-allowlisted syscalls to run but logs them to auditd/osquery for process auditing.
* `KILL` terminates any process that makes a non-allowlisted syscall.
* `ERRNO` prevents a syscall from running, but does not generate a logging event.

Seccomp allows us to reduce the attack surface of a container by preventing/logging syscalls considered to be unsafe or that can be used to escape a container. Doing so provides an additional layer of security between the container and the host as well as between containers. Below, you will find a list of the syscalls we automatically block in the Palantir platform.

:::callout{theme="danger"}
If your application makes a syscall listed below, the process will be terminated and our incident response team will be notified. If your use case requires use of these syscalls, contact Palantir support for assistance.
:::

|Linux call          |Description  |
|-------------------- |----------- |
|[ACCT ↗](https://man7.org/linux/man-pages/man2/acct.2.html)  |Enables or disables Berkeley Software Distribution (BSD) style accounting. |
|[ADD\_KEY ↗](https://man7.org/linux/man-pages/man2/add_key.2.html) |Creates a key in the kernel. If a key already exists, it will be updated. |
|[AFS\_SYSCALL ↗](https://man7.org/linux/man-pages/man2/afs_syscall.2.html)  |Unimplemented  |
|[BPF ↗](https://man7.org/linux/man-pages/man2/bpf.2.html) |Performs operations on the Berkeley Packet Filters. |
|[CLOCK\_SETTIME ↗](https://man7.org/linux/man-pages/man2/clock_settime.2.html) |Sets the time of a specified clock (clockid). |
|[CREATE\_MODULE ↗](https://man7.org/linux/man-pages/man2/create_module.2.html) |Deprecated post 2.6; kernel creates a loadable module entry. |
|[DELETE\_MODULE ↗](https://man7.org/linux/man-pages/man2/delete_module.2.html) |Attempts to remove an unused, loadable module by name. |
|[FANOTIFY\_INIT ↗](https://man7.org/linux/man-pages/man2/fanotify_init.2.html) |Requires CAP\_SYS\_ADMIN; creates a fanotify group and returns a descriptor for the event queue. |
|[FINIT\_MODULE ↗](https://man7.org/linux/man-pages/man2/finit_module.2.html) |Loads an ELF image into kernel space and performs sym relocation. |
|[GETPMSG ↗](https://man7.org/linux/man-pages/man2/getpmsg.2.html) |Unimplemented |
|[GET\_KERNEL\_SYMS ↗](https://man7.org/linux/man-pages/man2/get_kernel_syms.2.html) |Deprecated post 2.6; copies kernel syms to a table. |
|[GET\_MEMPOLICY ↗](https://man7.org/linux/man-pages/man2/get_mempolicy.2.html) |Retrieves the non-uniform memory access (NUMA) policy for a thread; NUMA nodes have separate memory controller per NUMA, and crossing nodes is slow.|
|[INIT\_MODULE ↗](https://man7.org/linux/man-pages/man2/init_module.2.html) |Loads an ELF image into kernel space. |
|[IOPERM ↗](https://man7.org/linux/man-pages/man2/ioperm.2.html) |Sets port input/output perms; i386 only. |
|[IOPL ↗](https://man7.org/linux/man-pages/man2/iopl.2.html) |Deprecated for ioperm i386 only; changes I/O privilege level. |
|[KCMP ↗](https://man7.org/linux/man-pages/man2/kcmp.2.html) |Compares two processes to determine if they share kernel resources (Virtual Memory, for example). |
|[KEXEC\_FILE\_LOAD ↗](https://man7.org/linux/man-pages/man2/kexec_file_load.2.html) |Loads a new kernel that can be executed by reboot. |
|[KEXEC\_LOAD ↗](https://man7.org/linux/man-pages/man2/kexec_load.2.html) |Loads a new kernel that can later be executed by reboot. |
|[KEYCTL ↗](https://man7.org/linux/man-pages/man2/keyctl.2.html) |Manipulates the kernel key management facility from user space. |
|[LOOKUP\_DCOOKIE ↗](https://man7.org/linux/man-pages/man2/lookup_dcookie.2.html) |Returns a directory entry path. |
|[MBIND ↗](https://man7.org/linux/man-pages/man2/mbind.2.html) |Set a memory policy for a memory range; used with Numa nodes. |
|[MIGRATE\_PAGES ↗](https://man7.org/linux/man-pages/man2/migrate_pages.2.html) |Moves all pages in a process to another set of nodes; requires CAP\_SYS\_NICE. |
|[MSGRCV ↗](https://man7.org/linux/man-pages/man2/msgrcv.2.html) |System V message queue operations. |
|[MOUNT ↗](https://man7.org/linux/man-pages/man2/mount.2.html) |Mounts a filesystem; requires CAP\_SYS\_ADMIN. |
|[MOVE\_PAGES ↗](https://man7.org/linux/man-pages/man2/move_pages.2.html) |Moves individual pages of a process to another node. |
|[NAME\_TO\_HANDLE\_AT ↗](https://man7.org/linux/man-pages/man2/name_to_handle_at.2.html) |Obtains a handle for a pathname and opens file via a handle. |
|[NFSSERVCTL ↗](https://man7.org/linux/man-pages/man2/nfsservctl.2.html) |Deprecated as of Linux 3.1; interface to the Kernel NFS Daemon. |
|[OPEN\_BY\_HANDLE\_AT ↗](https://man7.org/linux/man-pages/man2/open_by_handle_at.2.html) |Similar to NAME\_TO\_HANDLE\_AT; instead of returning the handle, opens the file using the handle.|
|[PERF\_EVENT\_OPEN ↗](https://man7.org/linux/man-pages/man2/perf_event_open.2.html) |Sets up performance monitoring. |
|[PIVOT\_ROOT ↗](https://man7.org/linux/man-pages/man2/pivot_root.2.html) |Changes the root mount; requires CAP\_SYS\_ADMIN. |
|[PKEY\_ALLOC ↗](https://man7.org/linux/man-pages/man2/pkey_alloc.2.html) |Allocates or frees a protection key. |
|[PKEY\_FREE ↗](https://man7.org/linux/man-pages/man2/pkey_free.2.html) |Allocates or frees a protection key. |
|[PKEY\_MPROTECT ↗](https://man7.org/linux/man-pages/man2/pkey_mprotect.2.html) |Sets protection on a region of memory. |
|[PROCESS\_VM\_READV ↗](https://man7.org/linux/man-pages/man2/process_vm_readv.2.html) |Transfers data between process address spaces. |
|[PROCESS\_VM\_WRITEV ↗](https://man7.org/linux/man-pages/man2/process_vm_writev.2.html) |Transfers data between process address spaces. |
|[PUTPMSG ↗](https://man7.org/linux/man-pages/man2/putpmsg.2.html) |Unimplemented |
|[QUERY\_MODULE ↗](https://man7.org/linux/man-pages/man2/query_module.2.html) |Deprecated in 2.6; queries the kernel for various information pertaining to modules. |
|[QUOTACTL ↗](https://man7.org/linux/man-pages/man2/quotactl.2.html) |Manipulates disk quotes; requires CAP\_SYS\_ADMIN. |
|[REBOOT ↗](https://man7.org/linux/man-pages/man2/reboot.2.html) |Reboots or enables the reboot keystroke (CTRL-ALT-DEL). |
|[REQUEST\_KEY ↗](https://man7.org/linux/man-pages/man2/request_key.2.html) |Requests a key form the kernel's key management facility. |
|[SECURITY ↗](https://man7.org/linux/man-pages/man2/security.2.html) |Unimplemented |
|[SETDOMAINNAME ↗](https://man7.org/linux/man-pages/man2/setdomainname.2.html) |Gets or sets NIS domain name; requires CAP\_SYS\_ADMIN. |
|[SETHOSTNAME ↗](https://man7.org/linux/man-pages/man2/sethostname.2.html) |Gets or sets the hostname;  requires CAP\_SYS\_ADMIN. |
|[SETNS ↗](https://man7.org/linux/man-pages/man2/setns.2.html) |Reallocates a thread with a name space; must have CAP\_SYS\_ADMIN in the desired namespace. |
|[SETSID ↗](https://man7.org/linux/man-pages/man2/setsid.2.html) |Creates a session and sets the process group ID. |
|[SETTIMEOFDAY ↗](https://man7.org/linux/man-pages/man2/settimeofday.2.html) |Sets the time of day and timezone/CAP\_SYS\_TIME. |
|[SET\_MEMPOLICY ↗](https://man7.org/linux/man-pages/man2/set_mempolicy.2.html) |Sets default NUMA memory policy. |
|[SWAPOFF ↗](https://man7.org/linux/man-pages/man2/swapoff.2.html) |Disables swap on a file/device; requires CAP\_SYS\_ADMIN. |
|[SWAPON ↗](https://man7.org/linux/man-pages/man2/swapon.2.html) |Enables swap on a file/device; requires CAP\_SYS\_ADMIN. |
|[SYSFS ↗](https://man7.org/linux/man-pages/man2/sysfs.2.html) |Gets filesystem type information. |
|[SYSLOG ↗](https://man7.org/linux/man-pages/man2/syslog.2.html) |Reads and/or clears kernel message ring buffer. |
|[TUXCALL ↗](https://man7.org/linux/man-pages/man2/tuxcall.2.html) |Unimplemented |
|[UMOUNT2 ↗](https://man7.org/linux/man-pages/man2/umount2.2.html) |Umounts a filesystem; requires CAP\_SYS\_ADMIN. |
|[UNSHARE ↗](https://man7.org/linux/man-pages/man2/unshare.2.html) |Disassociates parts of the process execution context; some, but not all, options require CAP\_SYS\_ADMIN. |
|[USELIB ↗](https://man7.org/linux/man-pages/man2/uselib.2.html) |Deprecated; loads a shared library to be used by calling process. |
|[USERFAULTFD ↗](https://man7.org/linux/man-pages/man2/userfaultfd.2.html) |Creates a file descriptor for handling page faults in user space.|
|[USTAT ↗](https://man7.org/linux/man-pages/man2/ustat.2.html) |Deprecated; gives filesystem stats. |
|[VHANGUP ↗](https://man7.org/linux/man-pages/man2/vhangup.2.html) |Virtually disconnects a terminal; requires CAP\_SYS\_TTY\_CONFIG. |
|[VSERVER ↗](https://man7.org/linux/man-pages/man2/vserver.2.html) |Unimplemented |
|[\_SYSCTL ↗](https://man7.org/linux/man-pages/man2/_sysctl.2.html) |Deprecated; reads and writes system parameters. |
