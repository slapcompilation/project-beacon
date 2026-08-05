<!-- source: https://palantir.com/docs/foundry/data-connection/agents-troubleshooting/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Troubleshooting reference

:::callout{theme="neutral"}
The Agent Manager is referred to as a "bootvisor" on the server where it is installed.
:::

This page contains information on [how to configure agent logs](#configure-agent-logs), describes several [common issues with agent configuration](#common-issues-with-agent-configuration), and provides debugging guidance.
The steps described must be taken after SSHing into the host where the agent has been installed.
Before exploring additional troubleshooting topics, we recommend first checking`./var/diagnostic/launch.yml` to confirm the agent successfully connected to Foundry. If the connection was unsuccessful, follow the instructions described in the field `enhancedMessage`.

[Common issues with agent configuration](#common-issues-with-agent-configuration)

* [Agent and agent manager shows "offline" status but returns "running" on the agent host](#agent-and-agent-manager-shows-offline-status-but-returns-running-on-the-agent-host)

* [Agent manager shows "offline" status](#agent-manager-shows-offline-status)

* [Bootstrapper shows "never reported" status](#bootstrapper-shows-never-reported-status)

* [Agent shows "online" but is not responding to restarts](#agent-shows-online-but-is-not-responding-to-restarts)

* [Agent status shows "Unhealthy"](#agent-status-shows-unhealthy)

* [Unable to download agent package](#unable-to-download-agent-package)

* [Unable to administer an agent](#unable-to-administer-an-agent)

* [Unable to create an agent due to PERMISSION\_DENIED error](#unable-to-create-an-agent-due-to-permission_denied-error)

[Agent configuration reference](#agent-configuration-reference)

* [Connect to data sources using the insecure TLSv1.0 and TLSv1.1 protocols](#connect-to-data-sources-using-the-insecure-tlsv10-and-tlsv11-protocols)
* [Configure agent logs](#configure-agent-logs)
* [What happens to cached files when the host where the agent is installed crashes?](#what-happens-to-cached-files-when-the-host-where-the-agent-is-installed-crashes)

## Common issues with agent configuration

#### Agent and Agent Manager shows "offline" status but returns "running" on the agent host

* The first step is to check that Foundry is reachable from the host where the agent is installed. To do this, run `curl -s https://<your domain name>/magritte-coordinator/api/ping > /dev/null && echo pass || echo fail` from the host where the agent is installed.
  * If everything is working, you should see `pass` as output. In which case you should:
    * Determine if a proxy is required to reach Foundry and if so, check whether the agent has been configured to use it (instructions on how to configure an agent to use a proxy can be found on the [proxy configuration](/docs/foundry/data-connection/agent-configuration-reference/#proxy-configuration) page). You can verify whether a proxy is being used by running `echo $http_proxy` on the command line of a Unix-based machine.
    * If you don't think a proxy is required or you have already configured one, contact your Palantir representative.
  * If Foundry is unreachable from the host, you might see an error such as: `curl: (6) Could not resolve host: ...`. In this instance, it is likely there is something blocking the connection (e.g. a firewall or a proxy), and you should contact your Palantir representative.

#### Agent manager shows "offline" status

* Check the contents of the `<agent-manager-install-location>/var/log/startup.log` file.
  * If you see the following error: `Caused by: java.net.BindException: {} Address already in use`, it means there is a process already running on the port to which the Agent Manager is trying to bind.
    * To resolve this, you should first ascertain to which port the Agent Manager is trying to bind. This can be done by checking the contents of the `<agent-manager-directory>/var/conf/install.yml` file and looking for a `port` parameter (e.g. `port: 1234`  - here 1234 is the port). Note if there is no port parameter defined, the Agent Manager will use the default port 7032.
    * Once you know the port to which the Agent Manager is trying to bind, you should identify the process that is already running on it. This can be achieved by running the following command: `ps aux | grep $(lsof -i:<PORT> |awk 'NR>1 {print $2}' |sort -n |uniq)` where `<PORT>` is the port to which the Agent Manager is trying to bind.
      * If the response returned by the above command contains: `com.palantir.magritte.bootvisor.BootvisorApplication` it means another Agent Manager is already running.
      * In this case you should determine if this is intentional; if so, you will need to change the port in the configuration to de-conflict the two Agent Managers by following the steps below. Otherwise, you'll need to determine which specific Agent Manager install you want to use on this host, stop any others that are running, and start up only the one you intend to use going forward.

  * To fix the `BindException` error, you will need to find a new port for the Agent Manager, that isn't currently being used.
    * Port numbers should be between 1025 and 65536 (port numbers 0 to 1024 are reserved for privileged services and designated as well-known ports).
    * You can check if a process is already running on a port by executing the following command: `lsof -i :<PORT>` where `<PORT>` is the chosen port number.

  * Once you have found an available port, you will need to add (or update) the `port` parameter in the configuration stored at `<agent-manager-directory>/var/conf/install.yml`

  * Below is an example **Agent Manager** configuration snippet with the port set to `7032`:
    ```yaml
    ...
    port: 7032
    auto-start-agent: true
    ```

  * Once you have saved the above configuration, restart the Agent Manager by running `<agent-manager-root>/service/bin/init.sh stop && <agent-manager-root>/service/bin/init.sh start`.

#### Bootstrapper shows "never reported" status

* Check the contents of the `<agent-manager-directory>/var/data/processes/<latest-bootstrapper-directory>/var/log/startup.log` file.

  * If you see the following error: `Caused by: java.net.BindException: {} Address already in use`, it means there is a process already running on the port to which the Bootstrapper is trying to bind.
    * In order to resolve this, you should first ascertain to which port the Bootstrapper is trying to bind. This can be done by navigating to the agent overview page within the Data Connection application. From there, you will need to select the "advanced" configuration button and finally click the "Bootstrapper" tab. The port to which the Bootstrapper will try to bind is defined under the `port` parameter (for example, `port: 1234`  - here 1234 is the port). Note the default port for the Bootstrapper is 7002.
    * Once you know the port to which the Bootstrapper is trying to bind, you should identify the process that is already running on it. This can be achieved by running the following command: `ps aux | grep $(lsof -i:$PORT |awk 'NR>1 {print $2}' |sort -n |uniq)` where `$PORT` is the port to which the Bootstrapper is trying to bind.
      * If the response returned by the above command contains `com.palantir.magritte.bootstrapper.MagritteBootstrapperApplication` it means another Bootstrapper is already running.
      * In this case, you should determine if this is intentional; if so, you will need to change the port in the configuration to de-conflict the two Bootstrappers by following the steps below. Otherwise, you'll need to determine which specific Bootstrapper install you want to use on this host, stop any others that are running, and start up only the one you intend to use going forward.

  * To fix the `BindException` error, you will need to find a new port for the Bootstrapper, that isn't currently being used.
    * Port numbers should be between 1025 and 65536 (port numbers 0 to 1024 are reserved for privileged services and designated as well-known ports).
    * You can check if a process is already running on a port by executing the following command: `lsof -i :<PORT>` where `<PORT>` is the chosen port number.

  * Once you have found an available port, you will need to set the `port` parameter in the Bootstrapper's configuration. This can be done by navigating to the agent overview page in the Data Connection application. From there select the advanced configuration button and finally navigate to the "Bootstrapper" tab.

  * Below is an example **Bootstrapper** configuration snippet with the port set to `7002`:
    ```yaml
    server:
      adminConnectors:
        ...
        port: 7002 #This is the port value
    ```

  * Once you have updated the configuration, you will need to save your changes and restart the agent for them to take effect.

#### Agent shows "online" but is not responding to restarts

More often than not, this is caused by another "ghost" instance of the agent running that you need to find and shut down.

To find and terminate old processes, follow the steps below:

1. Stop the Agent Manager by running: `<agent-manager-install-location>/service/bin/init.sh stop`.
2. Delete the `<agent-manager-install-location>/var/data/processes/index.json` file.
3. Run `for folder in $(ls -d <agent-manager-root>/var/data/processes/*/); do $folder/service/bin/init.sh stop; done` to shut down the old processes.
4. Return to Data Connection and check the agent is no longer reporting (takes 2-3 minutes).
5. Start the Agent Manager (`<agent-manager-install-location>/service/bin/init.sh start`).

:::callout{theme="neutral"}
Manually starting agents on the host where they are installed (as opposed to through Data Connection) can lead to the creation of "ghost" processes.
:::

#### Agent status shows "Unhealthy"

Often when the agent process shows as "unhealthy" it is because it has crashed or been shut down by either the operating system or another piece of software such as an antivirus.

There are multiple reasons why the operating system might have shut down the process, but the most common one is because the operating system does not have enough memory to run it, which is referred to as being OOM (Out Of Memory) killed.

To check if any of the agent or Explorer subprocesses were OOM killed by the operating system, you can run the following command: `grep "exited with return code 137" -r <agent-manager-directory> --include=*.log`. This will search all the log files within the Agent Manager directory for entries containing 'exited with return code 137' (return code 137 signifies a process was OOM killed).

The following is an example output produced by the above command and shows the agent subprocess is being OOM killed.: `./var/data/processes/bootstrapper~<>/var/log/magritte-bootstrapper.log:ERROR [timestamp] com.palantir.magritte.bootstrapper.ProcessMonitor: magritte-agent exited with return code 137`. If you see an output similar to this, you should follow the steps below on tuning heap sizes.

You can also check the operating system logs for OOM kill entries by running the following command: `dmesg -T | egrep -i 'killed process`. This command will search the kernel ring buffer for 'killed process' log entries, which indicates a process was OOM killed.

Actual log entries of OOM killed processes will look like the following:

* `[timestamp] Out of memory: Killed process 9423 (java) total-vm:2928192kB, anon-rss:108604kB, file-rss:0kB, shmem-rss:0kB, UID:0 pgtables:1232kB oom_score_adj:0`
* The above log line shows the process killed had a PID 9423 (note: your log messages may vary depending on Linux distribution and system configuration).
* In this scenario, you should try to verify whether the process being killed is related to your agent. The easiest way to do this is by aligning time stamps, i.e., if an entry's timestamp ties in with the time your agent became unhealthy it is likely the two are correlated. Note any entries that don't contain `(java)` can be ignored as they are not related to your agent.

##### Tuning heap sizes

Before you change any heap allocations, you should first:

* Calculate how much memory the host has available.
* To see how much memory the host has available, you can run `free -h`. On a 6 GB system, the output might look something like this:

```bash
                total        used        free      shared  buff/cache   available
Mem:          5.8Gi       961Mi       2.8Gi       9.0Mi       2.1Gi       4.6Gi
Swap:         1.0Gi          0B       1.0Gi
```

In the output produced by the `free` command, the `available` column shows how much memory can be used for starting new applications. To determine how much memory can be allocated to the agent, we recommend that you stop the agent and run `free -h` while the system is under normal to high load. The available value will tell you the maximum amount of memory you can devote to all agent processes combined. We recommend that you leave a buffer of approximately 2 - 4GB, if possible, to account for other processes on the system needing more memory, as well as off-heap memory usage by the agent processes. Note that not all versions of `free` show the available column, so you may need to check the documentation for the version on your system to find the equivalent information.

Determine how much memory is assigned to each of the following subprocesses: Agent Manager, Bootstrapper, agent, and Explorer.

In order to find out how much memory is assigned to the agent and Explorer subprocesses, you should navigate to the agent configuration page within Data Connection, choose the advanced configuration button, and select the "Bootstrapper" tab. From there you will see each of the subprocesses have their own configuration block; within each block you should see a `jvmHeapSize` parameter which defines how much memory is allocated to the associated processes.

By default, the Bootstrapper subprocess is assigned `512mb` of memory. This can be confirmed by first navigating to the `<agent-manager-directory>/var/data/processes/` directory; from there you will need to run `ls -lrt` to find the most recently created `bootstrapper~<uuid>` directory. Once in the most recently created `bootstrapper~<uuid>` directory, you can inspect the contents of the `./var/conf/launcher-custom.yml` file. Here, the `Xmx` value is the amount of memory assigned to the Bootstrapper.

By default, the Agent Manager subprocess is also assigned `512mb` of memory. This can be confirmed by inspecting the contents of the file `<agent-manager-directory>/var/conf/launcher-custom.yml`. Here, the `Xmx` value is the amount of memory assigned to the Agent Manager.

:::callout{theme="neutral"}
Agents installed on Windows machines do not use the `launcher-custom.yml` files and thus, by default, Java will allocate both the Agent Manager and Bootstrapper processes 25% of the total memory available to the system. To fix this you will need to set the Agent Manager and Bootstrapper heap sizes manually, which can be done by following the steps below:

1. Make sure you have killed all the agent processes, namely: (Agent Manager, Bootstrapper, agent, and Explorer).
2. Set JAVA\_HOME: `setx -m JAVA_HOME "{BOOTVISOR_INSTALL_DIR}\jdk\{JDK_VERSION}-win_x64\"`
3. Set the Agent Manager heap size: `setx -m MAGRITTE_BOOTVISOR_WIN_OPTS "-Xmx512M -Xms512M"`
4. Set the Bootstrapper heap size: `setx -m MAGRITTE_BOOTSTRAPPER_OPTS "-Xmx512M -Xms512M"`
5. Close the command prompt and open a fresh one. This is required for the settings above to take effect.
6. Start the Agent Manager: `.\service\bin\magritte-bootvisor-win`
:::

Once you have determined how much memory the host has available and how much memory is assigned to each of the above subprocesses, you should then decide whether to: decrease the amount of memory allocated to the above processes or increase the amount of memory available to the host.

Whether or not you can safely decrease the amount of memory used by the agent processes will depend on your agent settings (for example, the maximum number of concurrent syncs and file upload parallelism), the types of data being synced, and the typical load on the agent. Decreasing the heap size makes it less likely that the OS will kill the process but more likely that the java process will run out of heap space. You may need to test different values to find what works. Contact your Palantir representative if you need assistance tuning this value.

To decrease the amount of memory allocated to one (or multiple) of the subprocesses, do the following:

1. Decide on how much memory should be allocated to each of the aforementioned subprocesses.
   * *Note: We do not recommend reducing the heap sizes below the defaults which are listed below.*
2. Next, navigate to the agent within Data Connection, choose the advanced configuration button, and select the **Bootstrapper** tab.
3. Here, you can set the `jvmHeapSize` parameter for each of the individual subprocesses.
4. Below is an example **Bootstrapper configuration snippet** with the **agent** jvmHeapSize set to 3gb:
   ```yaml
   agent:
       ....
       jvmHeapSize: 3g #This is jvm heap size value
   ```
5. Once you have updated the configuration, you will need to save your changes and restart the agent for them to take effect.

**Default heap allocations**

By default an agent requires ~3gb of memory, allocated as follows:

* 1gb for the agent subprocess
* 1gb for the Explorer subprocess
* 512mb for the Bootstrapper subprocess
* 512mb for the agent Manager subprocess

Java processes also use some amount of off-heap memory; thus, we recommend you ensure there is at least ≥ 4gb left free for them.

#### Unable to download agent package

There are two main causes of failed agent downloads: network connections and expired links.

If you can connect to Foundry but are getting an invalid `tar.gz` file or an error message on the download, you may have an expired or invalidated link.

* *Expired links:* Download links expire after ten minutes.
* *Invalidated links:* Download links are protected with a one-time download secret. Pasting agent download links in applications such as Microsoft Teams can invalidate the link because those applications will attempt to scan the link to see if it can be previewed; this scan invalidates the one-time download secret. If you have an invalid link, try regenerating the link in the UI and retyping the two secret words instead of copying the whole link.

If you encounter a `disconnected unexpectedly` error during the agent package download, try forcing `curl` to use HTTP 1.0 by adding the `--http1.0` flag to your download command. This can resolve protocol negotiation issues that may occur in certain network environments.

#### Unable to administer an agent

A user must be an editor of a Project to create an agent in that Project, but must be an owner of the Project to administer the agents within that Project. That means that a user may create an agent and then be unable to generate download links or perform other administrative tasks on the agent. For more on agent permissions, review the guidance in our [permissions reference](/docs/foundry/data-connection/permissions/) documentation.

#### Unable to create an agent due to PERMISSION\_DENIED error

If you receive a `PERMISSION_DENIED` error when attempting to create an agent, verify the following:

* **Organization-level role:** You must have the `Organization administrator`, `Data flows administrator`, or a custom role with the `Create agent` workflow assigned to you. Organization roles are managed on the **Organization permissions** page in Control Panel.
* **Project-level role:** You must be an `Editor` or `Owner` of the project in which you want to save the newly created agent.

If you only have `Editor` permissions on an existing project but lack the required organization-level role, try creating the agent in a different project where you have the appropriate permissions, or request the necessary role from your administrator.

For more details on agent permissions, review the guidance in our [permissions reference](/docs/foundry/data-connection/permissions/) documentation.

### Agent configuration reference

#### Connect to data sources using the insecure TLSv1.0 and TLSv1.1 protocols

TLSv.1.0 and TLSv1.1 are not supported by Palantir as they are outdated and insecure protocols. Amazon Corretto builds of the OpenJDK used by Data Connection agents explicitly disable TLSv1.0 and TLSv1.1 by default under the `jdk.tls.disabledAlgorithms` security property in the `java.security` file.

Attempts to connect to a data sources system exclusively supporting TLSv1.0 and TLSv1.1 will fail with various errors including `Error: The server selected protocol version TLS10 is not accepted by client preferences`.

:::callout{theme="danger"}
We actively discourage the usage of deprecated versions of TLS. Palantir is not responsible for security risks associated with its usage.
:::

If there is a critical need to temporarily support TLSv1.0 and TLSv1.1, perform the following steps:

1. From the agent overview page, navigate to **Agent settings** and select **Advanced** in the **Manage Configuration** section. Then, select the `Bootstrapper` tab.
2. Add `tlsProtocols` entries to both the `agent` and `explorer` configuration blocks followed by the protocols you want to enable. Be sure to also include TLSv1.2 so any sources using it will not break. For example:

```yaml
agent:
    tlsProtocols:
      - TLSv1
      - TLSv1.1
      - TLSv1.2
...
explorer:
    tlsProtocols:
      - TLSv1
      - TLSv1.1
      - TLSv1.2
...
```

![Agent with custom legacy TLS protocols configured](/docs/resources/foundry/data-connection/agent-tls.png)

3. Select **Restart agent**.

With this configuration, the agent will continue to allow TLSv1.0 and TLSv1.1 across agent upgrades and restarts. Once the datasource has moved to new TLS versions, revert all changes made to the advanced agent configuration.

#### Configure agent logs

To adjust the log storage settings for an agent on its host machine, follow the steps below:

1. In Data Connection, navigate to the **Agents** page. Select the name of the agent you want to configure.
2. In the Configuration panel, select **Advanced**.
3. The configuration options for logging can be found under the **Logging** block. Here, you can configure limits on when to start discarding logs, if and how to archive logs, and other settings.
   * Note that the configuration should consider the allocated agent host machine resources, your preference of log level granularity, and your preference of log retention. For more information and guidance, consult the [Dropwizard configuration reference ↗](https://www.dropwizard.io/en/latest/manual/configuration.html#logging).
4. Restart the agent in Foundry by selecting **Restart Agent** in the upper-right corner of the screen.

Your new configuration should now be in effect.

#### How long has my agent been down (unavailable)?

There are a number of reasons your agent could be unavailable; for instance, the agent may be restarting or the underlying hardware running the agent could be offline or restarting.

There are two ways to determine when the agent first became unavailable:

* After selecting your agent in the Data Connection UI, you can see a visual representation of metrics related to uptime and availability in the `Metrics` tab.
* In the **Overview** section of the Data Connection UI, you can see the status of your agent, as well as the date and time the agent's status was last reported.

#### What happens to cached files when the host where the agent is installed crashes?

The files will remain on disk until the Bootvisor cleans up old process folders (30 days or 10 old folders triggers a clean up). These files are encrypted and the keys to decrypt them only existed in the memory of processes that died.
