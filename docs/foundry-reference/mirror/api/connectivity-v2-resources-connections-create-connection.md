<!-- source: https://palantir.com/docs/foundry/api/connectivity-v2-resources/connections/create-connection/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Connection

`POST /api/v2/connectivity/connections`

Creates a new Connection with a [direct connection](/docs/foundry/data-connection/core-concepts/#direct-connection) runtime.

Any secrets specified in the request body are transmitted over the network encrypted using TLS. Once the
secrets reach Foundry's servers, they will be temporarily decrypted and remain in plaintext in memory to
be processed as needed. They will stay in plaintext in memory until the garbage collection process cleans
up the memory. The secrets are always stored encrypted on our servers.
By using this endpoint, you acknowledge and accept any potential risks associated with the temporary
in-memory handling of secrets. If you do not want your secrets to be temporarily decrypted, you should
use the Foundry UI instead.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-connection-write`.

Scopes: `api:connectivity-connection-write`

## Request

- `CreateConnectionRequest` · object · required
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `configuration` · union · required
    - `s3` · object
      - `connectionTimeoutMillis` · string
        "The amount of time (in milliseconds) to wait when initially establishing a connection before giving up and timing out. If not specified, defaults to 10000 as defined by the [AWS SDK default](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/ClientConfiguration.html#DEFAULT_CONNECTION_TIMEOUT)."
      - `maxErrorRetry` · integer
        "The maximum number of retry attempts for failed requests to the S3 service. If not specified, defaults to 3 as defined by the [AWS SDK default](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/retry-strategy.html#retry-strategies)."
      - `bucketUrl` · string · required
        "The URL of the S3 bucket. The URL should contain a trailing slash."
      - `clientKmsConfiguration` · object
        "The client-side KMS key to use for encryption and decryption of data in the S3 bucket. If not specified, the default KMS key for the bucket is used."
        - `kmsKey` · string · required
          "The client-side KMS key to use for encryption and decryption of data in the S3 bucket. If not specified, the default KMS key for the bucket is used."
        - `kmsRegion` · string
          "The region of the client-side KMS key to use for encryption and decryption of data in the S3 bucket. If not specified, the default KMS key region for the bucket is used."
      - `matchSubfolderExactly` · boolean
        "If true, only files in the subfolder specified in the bucket URL will be synced. If false, all files in the bucket will be synced. If not specified, defaults to false."
      - `stsRoleConfiguration` · object
        "The configuration needed to assume a role to connect to the S3 external system."
        - `roleArn` · string · required
          "The Amazon Resource Name (ARN) of the role to assume. For more information, see the official [AWS documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html#principal-arn-format)."
        - `roleSessionName` · string · required
          "An identifier for the assumed role session. The value can be any string that you assume will be unique within the AWS account. For more information, see the official [AWS documentation](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters)."
        - `roleSessionDuration` · object
          "The duration of the role session. The value specified can range from 900 seconds (15 minutes) up to the maximum session duration set for the role. The maximum session duration setting can have a value from 1 hour to 12 hours. For more details see the official [AWS documentation](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters)."
          - `value` · integer · required
            "The duration value."
          - `unit` · enum · required
            one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
            "The unit of duration."
        - `externalId` · string
          "A unique identifier that is used by third parties when assuming roles in their customers' accounts. For more information, see the official [AWS documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html)."
        - `stsEndpoint` · string
          "By default, the AWS Security Token Service (AWS STS) is available as a global service, and all AWS STS requests go to a single endpoint at https://sts.amazonaws.com. AWS recommends using Regional AWS STS endpoints instead of the global endpoint to reduce latency, build in redundancy, and increase session token validity."
      - `s3Endpoint` · string
        "The endpoint of the S3 service. This is used to connect to a custom S3 service that is not AWS S3. If not specified, defaults to the [AWS S3 endpoint](https://docs.aws.amazon.com/general/latest/gr/s3.html). Warning: Specifying a region and a custom endpoint containing a region can lead to unexpected behavior."
      - `socketTimeoutMillis` · string
        "The amount of time (in milliseconds) to wait for data to be transferred over an established, open connection. If not specified, defaults to 50000 as defined by the [AWS SDK default](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/ClientConfiguration.html#DEFAULT_SOCKET_TIMEOUT)."
      - `enableRequesterPays` · boolean
        "Defaults to false, unless set and overwritten. If true, includes the [requester pays header](https://docs.aws.amazon.com/AmazonS3/latest/userguide/RequesterPaysBuckets.html) in requests, allowing reads from requester pays buckets."
      - `s3EndpointSigningRegion` · string
        "The region used when constructing the S3 client using a custom endpoint. This is often not required and would only be needed if you are using the S3 connector with an S3-compliant third-party API, and are also setting a custom endpoint that requires a non-default region."
      - `region` · string
        "The region representing the location of the S3 bucket. Warning: Specifying a region and a custom endpoint containing a region can lead to unexpected behavior."
      - `authenticationMode` · union
        "The authentication mode to use to connect to the S3 external system. No authentication mode is required to connect to publicly accessible AWS S3 buckets."
        - `awsAccessKey` · object
          "[Access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html) are long-term credentials for an IAM user or the AWS account root user. Access keys consist of two parts: an access key ID (for example, AKIAIOSFODNN7EXAMPLE) and a secret access key (for example, wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY). You must use both the access key ID and secret access key together to authenticate your requests."
          - `accessKeyId` · string · required
          - `secretAccessKey` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `cloudIdentity` · object
          "[Cloud identities](/docs/foundry/administration/configure-cloud-identities/) allow you to authenticate to cloud provider resources without the use of static credentials."
          - `cloudIdentityRid` · string · required
            "The Resource Identifier (RID) of a Cloud Identity."
        - `oidc` · object
          "[OpenID Connect (OIDC)](/docs/foundry/data-connection/oidc/) is an open authentication protocol that allows you to authenticate to external system resources without the use of static credentials."
          - `audience` · string · required
            "The configured audience that identifies the external system."
          - `issuerUrl` · string · required
            "The URL that identifies Foundry as an OIDC identity provider."
          - `subject` · string · required
            "The RID of the Connection that is connecting to the external system."
      - `proxyConfiguration` · object
        "The configuration needed to connect to the S3 external system through a proxy."
        - `host` · string · required
          "Domain name, IPv4, or IPv6 address. `protocol` and `port` must be specified separately."
        - `port` · integer · required
        - `nonProxyHosts` · list
          "A list of hosts that can bypass the proxy, such as those used for STS Role. You can also use "*" wildcards."
        - `protocol` · enum
          one of `HTTP`, `HTTPS`
          "If defined, must be "HTTP" or "HTTPS". Defaults to "HTTPS"."
        - `credentials` · object
          - `username` · string · required
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
      - `maxConnections` · integer
        "The maximum number of HTTP connections to the S3 service per sync. If not specified, defaults to 50 as defined by the [AWS SDK default](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/ClientConfiguration.html#DEFAULT_MAX_CONNECTIONS)."
    - `rest` · object
      - `additionalSecrets` · union
        "Additional secrets that can be referenced in code and webhook configurations. If not provided, no additional secrets will be created."
        - `asSecretsWithPlaintextValues` · object
          "A map representing secret name to plaintext secret value pairs. This should be used when creating or updating additional secrets for a REST connection."
          - `secrets` · map
            "The additional secrets that can be referenced in code and webhook configurations."
            - `SecretName` · string · required
            - `PlaintextValue` · string · required
        - `asSecretsNames` · object
          "A list of secret names that can be referenced in code and webhook configurations. This will be provided to the client when fetching the RestConnectionConfiguration."
          - `secretNames` · list
            "The names of the additional secrets that can be referenced in code and webhook configurations."
            - `SecretName` · string · required
      - `oauth2ClientRid` · string
        "The RID of the [Outbound application](/docs/foundry/administration/configure-outbound-applications) that is used to authenticate to the external system via OAuth2. Currently, a connection may use only one outbound application for OAuth 2.0 authentication. Selecting a different outbound application will update the configuration for all domains with OAuth 2.0 as the selected authorization."
      - `domains` · list
        "The domains that the connection is allowed to access. At least one domain must be specified."
        - `Domain` · object · required
          "The domain that the connection is allowed to access."
          - `scheme` · enum
            one of `HTTP`, `HTTPS`
            "The scheme of the domain that the connection is allowed to access. If not specified, defaults to HTTPS."
          - `host` · string · required
            "The domain name, IPv4, or IPv6 address."
          - `port` · integer
            "The port number of the domain that the connection is allowed to access."
          - `auth` · union
            "The URI scheme must be HTTPS if using any authentication. If not specified, no authentication is required."
            - `bearerToken` · object
              "The bearer token used to authenticate to the external system."
              - `bearerToken` · union · required
                "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
                - `asSecretName` · object
                  - `value` · string · required
                - `asPlaintextValue` · object
                  - `value` · string · required
            - `apiKey` · object
              "The API key used to authenticate to the external system. This can be configured as a header or query parameter."
              - `location` · union · required
                "The location of the API key in the request."
                - `header` · object
                  - `headerName` · string · required
                    "The name of the header that the API key is passed in."
                - `queryParameter` · object
                  - `queryParameterName` · string · required
                    "The name of the query parameter that the API key is passed in."
              - `apiKey` · union · required
                "The value of the API key."
                - `asSecretName` · object
                  - `value` · string · required
                - `asPlaintextValue` · object
                  - `value` · string · required
            - `basic` · object
              - `username` · string · required
              - `password` · union · required
                "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
                - `asSecretName` · object
                  - `value` · string · required
                - `asPlaintextValue` · object
                  - `value` · string · required
            - `oauth2` · object
              "In order to use OAuth2 you must have an Outbound application configured in the [Foundry Control Panel Organization settings](/docs/foundry/administration/configure-outbound-applications#create-an-outbound-application). The RID of the Outbound application must be configured in the RestConnectionConfiguration in the `oauth2ClientRid` field."
    - `snowflake` · object
      - `schema` · string
        "Specifies the default schema to use for the specified database once connected. If unspecified, defaults to the empty string. The specified schema should be an existing schema for which the specified default role has privileges. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#schema"
      - `database` · string
        "Specifies the default database to use once connected. If unspecified, defaults to the empty string. The specified database should be an existing database for which the specified default role has privileges. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#db"
      - `role` · string
        "Specifies the default access control role to use in the Snowflake session initiated by the driver. If unspecified, no role will be used when the session is initiated by the driver. The specified role should be an existing role that has already been assigned to the specified user for the driver. If the specified role has not already been assigned to the user, the role is not used when the session is initiated by the driver. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#role"
      - `accountIdentifier` · string · required
        "An [account identifier](https://docs.snowflake.com/en/user-guide/admin-account-identifier) uniquely identifies a Snowflake account within your organization, as well as throughout the global network of Snowflake-supported cloud platforms and cloud regions. The URL for an account uses the following format: <account_identifier>.snowflakecomputing.com. An example URL is https://acme-test_aws_us_east_2.snowflakecomputing.com."
      - `jdbcProperties` · map
        "A map of [properties](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Properties.html) passed to the JDBC driver to configure behavior. Refer to the documentation of your specific connection type for additional available JDBC properties to add to your connection configuration. This should only contain unencrypted properties, all values specified here are sent unencrypted to Foundry."
      - `warehouse` · string
        "Specifies the virtual warehouse to use once connected. If unspecified, defaults to the empty string. The specified warehouse should be an existing warehouse for which the specified default role has privileges. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#warehouse"
      - `authenticationMode` · union · required
        "The authentication mode to use to connect to the Snowflake database."
        - `externalOauth` · object
        - `keyPair` · object
          - `privateKey` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
          - `user` · string · required
        - `basic` · object
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
          - `username` · string · required
    - `databricks` · object
      - `hostName` · string · required
        "The hostname of the Databricks workspace."
      - `httpPath` · string · required
        "The Databricks compute resource’s HTTP Path value."
      - `jdbcProperties` · map
        "A map of [properties](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Properties.html) passed to the JDBC driver to configure behavior. Refer to the documentation of your specific connection type for additional available JDBC properties to add to your connection configuration. This should only contain unencrypted properties, all values specified here are sent unencrypted to Foundry."
      - `authentication` · union · required
        "The method of authentication to use."
        - `workflowIdentityFederation` · object
          - `audience` · string · required
            "Identifies the recipients that the access token is intended for as a string URI. This should be the primary host name where the Connection lives."
          - `servicePrincipalApplicationId` · string
            "The ID of the Databricks [service principal](https://docs.databricks.com/aws/en/admin/users-groups/service-principals). If provided, a federated JWT token is exchanged using a service principal federation policy. If not provided, a federated JWT token is exchanged using an account federation policy."
        - `oauthM2M` · object
          - `clientID` · string · required
            "The client ID for the service principal."
          - `clientSecret` · union · required
            "The value of the client secret."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `personalAccessToken` · object
          - `personalAccessToken` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `basic` · object
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
          - `username` · string · required
    - `smb` · object
      - `proxy` · object
        "Egress proxy to pass all traffic through."
        - `hostname` · string · required
        - `port` · integer · required
        - `protocol` · enum · required
          one of `HTTP`, `SOCKS`
      - `hostname` · string · required
        "Any identifier that can resolve to a server hosting an SMB share. This includes IP addresses, local network names (e.g. FS-SERVER-01) or FQDNs. Should not include any protocol information like https://, smb://, etc"
      - `port` · integer
        "445 by default"
      - `auth` · union · required
        - `usernamePassword` · object
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
          - `domain` · string
            "Optionally specify a Windows domain to use when authenticating. Normal DNS domain restrictions apply but the top-level domain might be something non-standard like .local. Defaults to WORKGROUP"
          - `username` · string · required
      - `share` · string · required
        "Must be a valid SMB share name. https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/dc9978d7-6299-4c5a-a22d-a039cdc716ea"
      - `baseDirectory` · string
        "All reads and writes in this source will happen in this subdirectory"
      - `requireMessageSigning` · boolean
        "If true, the client will request that the server sign all messages. If the server does not support message signing, the connection will fail. Defaults to true."
    - `jdbc` · object
      - `credentials` · object
        - `username` · string · required
        - `password` · union · required
          "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
          - `asSecretName` · object
            - `value` · string · required
          - `asPlaintextValue` · object
            - `value` · string · required
      - `driverClass` · string · required
        "The fully-qualified driver class name that is used to connect to the database."
      - `jdbcProperties` · map
        "A map of [properties](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Properties.html) passed to the JDBC driver to configure behavior. Refer to the documentation of your specific connection type for additional available JDBC properties to add to your connection configuration. This should only contain unencrypted properties, all values specified here are sent unencrypted to Foundry."
      - `url` · string · required
        "The URL that the JDBC driver uses to connect to a database."
  - `displayName` · string · required
    "The display name of the Connection. The display name must not be blank."
  - `worker` · union · required
    "[The worker of a Connection](/docs/foundry/data-connection/core-concepts/#workers), which defines where compute for capabilities are run."
    - `unknownWorker` · object
    - `foundryWorker` · object
      - `networkEgressPolicyRids` · list
        - `NetworkEgressPolicyRid` · string · required
          "The Resource Identifier (RID) of a Network Egress Policy."

## Response

- `Connection` · object · required
  "The created Connection"
  - `rid` · string · required
    "The Resource Identifier (RID) of a Connection (also known as a source)."
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `displayName` · string · required
    "The display name of the Connection. The display name must not be blank."
  - `exportSettings` · object · required
    "The [export settings of a Connection](/docs/foundry/data-connection/export-overview/#enable-exports-for-source)."
    - `exportsEnabled` · boolean · required
      "Allow exporting datasets from Foundry to this Connection."
    - `exportEnabledWithoutMarkingsValidation` · boolean · required
      "In certain interactive workflows the Connection can be used in, it is not currently possible to validate the security markings of the data being exported. By enabling exports without markings validation, you acknowledge that you are responsible for ensuring that the data being exported is compliant with your organization's policies."
  - `worker` · union · required
    "[The worker of a Connection](/docs/foundry/data-connection/core-concepts/#workers), which defines where compute for capabilities are run."
    - `unknownWorker` · object
      "A ConnectionWorker that is not supported in the Platform APIs. This can happen because either the ConnectionWorker configuration is malformed, or because the ConnectionWorker is a legacy one. The ConnectionWorker should be updated to use the [Foundry worker](/docs/foundry/data-connection/core-concepts/#foundry-worker) with either direct egress policies or agent proxy egress policies."
    - `foundryWorker` · object
      "The [Foundry worker](/docs/foundry/data-connection/core-concepts/#foundry-worker) is used to run capabilities in Foundry. This is the preferred method for connections, as these connections benefit from Foundry's containerized and scalable job execution, improved stability and do not incur the maintenance overhead associated with agents."
      - `networkEgressPolicyRids` · list
        - `NetworkEgressPolicyRid` · string · required
          "The Resource Identifier (RID) of a Network Egress Policy."
  - `configuration` · union · required
    - `s3` · object
      "The configuration needed to connect to an [AWS S3 external system (or any other S3-like external systems that implement the s3a protocol)](/docs/foundry/available-connectors/amazon-s3/#amazon-s3)."
      - `bucketUrl` · string · required
        "The URL of the S3 bucket. The URL should contain a trailing slash."
      - `s3Endpoint` · string
        "The endpoint of the S3 service. This is used to connect to a custom S3 service that is not AWS S3. If not specified, defaults to the [AWS S3 endpoint](https://docs.aws.amazon.com/general/latest/gr/s3.html). Warning: Specifying a region and a custom endpoint containing a region can lead to unexpected behavior."
      - `region` · string
        "The region representing the location of the S3 bucket. Warning: Specifying a region and a custom endpoint containing a region can lead to unexpected behavior."
      - `authenticationMode` · union
        "The authentication mode to use to connect to the S3 external system. No authentication mode is required to connect to publicly accessible AWS S3 buckets."
        - `awsAccessKey` · object
          "[Access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html) are long-term credentials for an IAM user or the AWS account root user. Access keys consist of two parts: an access key ID (for example, AKIAIOSFODNN7EXAMPLE) and a secret access key (for example, wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY). You must use both the access key ID and secret access key together to authenticate your requests."
          - `accessKeyId` · string · required
          - `secretAccessKey` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `cloudIdentity` · object
          "[Cloud identities](/docs/foundry/administration/configure-cloud-identities/) allow you to authenticate to cloud provider resources without the use of static credentials."
          - `cloudIdentityRid` · string · required
            "The Resource Identifier (RID) of a Cloud Identity."
        - `oidc` · object
          "[OpenID Connect (OIDC)](/docs/foundry/data-connection/oidc/) is an open authentication protocol that allows you to authenticate to external system resources without the use of static credentials."
          - `audience` · string · required
            "The configured audience that identifies the external system."
          - `issuerUrl` · string · required
            "The URL that identifies Foundry as an OIDC identity provider."
          - `subject` · string · required
            "The RID of the Connection that is connecting to the external system."
      - `s3EndpointSigningRegion` · string
        "The region used when constructing the S3 client using a custom endpoint. This is often not required and would only be needed if you are using the S3 connector with an S3-compliant third-party API, and are also setting a custom endpoint that requires a non-default region."
      - `clientKmsConfiguration` · object
        "The client-side KMS key to use for encryption and decryption of data in the S3 bucket. If not specified, the default KMS key for the bucket is used."
        - `kmsKey` · string · required
          "The client-side KMS key to use for encryption and decryption of data in the S3 bucket. If not specified, the default KMS key for the bucket is used."
        - `kmsRegion` · string
          "The region of the client-side KMS key to use for encryption and decryption of data in the S3 bucket. If not specified, the default KMS key region for the bucket is used."
      - `stsRoleConfiguration` · object
        "The configuration needed to assume a role to connect to the S3 external system."
        - `roleArn` · string · required
          "The Amazon Resource Name (ARN) of the role to assume. For more information, see the official [AWS documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html#principal-arn-format)."
        - `roleSessionName` · string · required
          "An identifier for the assumed role session. The value can be any string that you assume will be unique within the AWS account. For more information, see the official [AWS documentation](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters)."
        - `roleSessionDuration` · object
          "The duration of the role session. The value specified can range from 900 seconds (15 minutes) up to the maximum session duration set for the role. The maximum session duration setting can have a value from 1 hour to 12 hours. For more details see the official [AWS documentation](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters)."
          - `value` · integer · required
            "The duration value."
          - `unit` · enum · required
            one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
            "The unit of duration."
        - `externalId` · string
          "A unique identifier that is used by third parties when assuming roles in their customers' accounts. For more information, see the official [AWS documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html)."
        - `stsEndpoint` · string
          "By default, the AWS Security Token Service (AWS STS) is available as a global service, and all AWS STS requests go to a single endpoint at https://sts.amazonaws.com. AWS recommends using Regional AWS STS endpoints instead of the global endpoint to reduce latency, build in redundancy, and increase session token validity."
      - `proxyConfiguration` · object
        "The configuration needed to connect to the S3 external system through a proxy."
        - `host` · string · required
          "Domain name, IPv4, or IPv6 address. `protocol` and `port` must be specified separately."
        - `port` · integer · required
        - `nonProxyHosts` · list
          "A list of hosts that can bypass the proxy, such as those used for STS Role. You can also use "*" wildcards."
        - `protocol` · enum
          one of `HTTP`, `HTTPS`
          "If defined, must be "HTTP" or "HTTPS". Defaults to "HTTPS"."
        - `credentials` · object
          - `username` · string · required
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
      - `maxConnections` · integer
        "The maximum number of HTTP connections to the S3 service per sync. If not specified, defaults to 50 as defined by the [AWS SDK default](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/ClientConfiguration.html#DEFAULT_MAX_CONNECTIONS)."
      - `connectionTimeoutMillis` · string
        "The amount of time (in milliseconds) to wait when initially establishing a connection before giving up and timing out. If not specified, defaults to 10000 as defined by the [AWS SDK default](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/ClientConfiguration.html#DEFAULT_CONNECTION_TIMEOUT)."
      - `socketTimeoutMillis` · string
        "The amount of time (in milliseconds) to wait for data to be transferred over an established, open connection. If not specified, defaults to 50000 as defined by the [AWS SDK default](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/ClientConfiguration.html#DEFAULT_SOCKET_TIMEOUT)."
      - `maxErrorRetry` · integer
        "The maximum number of retry attempts for failed requests to the S3 service. If not specified, defaults to 3 as defined by the [AWS SDK default](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/retry-strategy.html#retry-strategies)."
      - `matchSubfolderExactly` · boolean
        "If true, only files in the subfolder specified in the bucket URL will be synced. If false, all files in the bucket will be synced. If not specified, defaults to false."
      - `enableRequesterPays` · boolean
        "Defaults to false, unless set and overwritten. If true, includes the [requester pays header](https://docs.aws.amazon.com/AmazonS3/latest/userguide/RequesterPaysBuckets.html) in requests, allowing reads from requester pays buckets."
    - `rest` · object
      "The configuration needed to connect to a [REST external system](/docs/foundry/available-connectors/rest-apis)."
      - `domains` · list
        "The domains that the connection is allowed to access. At least one domain must be specified."
        - `Domain` · object · required
          "The domain that the connection is allowed to access."
          - `scheme` · enum
            one of `HTTP`, `HTTPS`
            "The scheme of the domain that the connection is allowed to access. If not specified, defaults to HTTPS."
          - `host` · string · required
            "The domain name, IPv4, or IPv6 address."
          - `port` · integer
            "The port number of the domain that the connection is allowed to access."
          - `auth` · union
            "The URI scheme must be HTTPS if using any authentication. If not specified, no authentication is required."
            - `bearerToken` · object
              "The bearer token used to authenticate to the external system."
              - `bearerToken` · union · required
                "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
                - `asSecretName` · object
                  - `value` · string · required
                - `asPlaintextValue` · object
                  - `value` · string · required
            - `apiKey` · object
              "The API key used to authenticate to the external system. This can be configured as a header or query parameter."
              - `location` · union · required
                "The location of the API key in the request."
                - `header` · object
                  - `headerName` · string · required
                    "The name of the header that the API key is passed in."
                - `queryParameter` · object
                  - `queryParameterName` · string · required
                    "The name of the query parameter that the API key is passed in."
              - `apiKey` · union · required
                "The value of the API key."
                - `asSecretName` · object
                  - `value` · string · required
                - `asPlaintextValue` · object
                  - `value` · string · required
            - `basic` · object
              - `username` · string · required
              - `password` · union · required
                "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
                - `asSecretName` · object
                  - `value` · string · required
                - `asPlaintextValue` · object
                  - `value` · string · required
            - `oauth2` · object
              "In order to use OAuth2 you must have an Outbound application configured in the [Foundry Control Panel Organization settings](/docs/foundry/administration/configure-outbound-applications#create-an-outbound-application). The RID of the Outbound application must be configured in the RestConnectionConfiguration in the `oauth2ClientRid` field."
      - `additionalSecrets` · union
        "Additional secrets that can be referenced in code and webhook configurations. If not provided, no additional secrets will be created."
        - `asSecretsWithPlaintextValues` · object
          "A map representing secret name to plaintext secret value pairs. This should be used when creating or updating additional secrets for a REST connection."
          - `secrets` · map
            "The additional secrets that can be referenced in code and webhook configurations."
            - `SecretName` · string · required
            - `PlaintextValue` · string · required
        - `asSecretsNames` · object
          "A list of secret names that can be referenced in code and webhook configurations. This will be provided to the client when fetching the RestConnectionConfiguration."
          - `secretNames` · list
            "The names of the additional secrets that can be referenced in code and webhook configurations."
            - `SecretName` · string · required
      - `oauth2ClientRid` · string
        "The RID of the [Outbound application](/docs/foundry/administration/configure-outbound-applications) that is used to authenticate to the external system via OAuth2. Currently, a connection may use only one outbound application for OAuth 2.0 authentication. Selecting a different outbound application will update the configuration for all domains with OAuth 2.0 as the selected authorization."
    - `snowflake` · object
      "The configuration needed to connect to a Snowflake database."
      - `accountIdentifier` · string · required
        "An [account identifier](https://docs.snowflake.com/en/user-guide/admin-account-identifier) uniquely identifies a Snowflake account within your organization, as well as throughout the global network of Snowflake-supported cloud platforms and cloud regions. The URL for an account uses the following format: <account_identifier>.snowflakecomputing.com. An example URL is https://acme-test_aws_us_east_2.snowflakecomputing.com."
      - `database` · string
        "Specifies the default database to use once connected. If unspecified, defaults to the empty string. The specified database should be an existing database for which the specified default role has privileges. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#db"
      - `role` · string
        "Specifies the default access control role to use in the Snowflake session initiated by the driver. If unspecified, no role will be used when the session is initiated by the driver. The specified role should be an existing role that has already been assigned to the specified user for the driver. If the specified role has not already been assigned to the user, the role is not used when the session is initiated by the driver. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#role"
      - `schema` · string
        "Specifies the default schema to use for the specified database once connected. If unspecified, defaults to the empty string. The specified schema should be an existing schema for which the specified default role has privileges. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#schema"
      - `warehouse` · string
        "Specifies the virtual warehouse to use once connected. If unspecified, defaults to the empty string. The specified warehouse should be an existing warehouse for which the specified default role has privileges. See https://docs.snowflake.com/developer-guide/jdbc/jdbc-parameters#warehouse"
      - `authenticationMode` · union · required
        "The authentication mode to use to connect to the Snowflake database."
        - `externalOauth` · object
          "Use an External OAuth security integration to connect and authenticate to Snowflake. See https://docs.snowflake.com/en/user-guide/oauth-ext-custom"
          - `audience` · string · required
            "Identifies the recipients that the access token is intended for as a string URI."
          - `issuerUrl` · string · required
            "Identifies the principal that issued the access token as a string URI."
          - `subject` · string · required
            "The RID of the Connection that is connecting to the external system."
        - `keyPair` · object
          "Use a key-pair to connect and authenticate to Snowflake. See https://docs.snowflake.com/en/user-guide/key-pair-auth"
          - `user` · string · required
          - `privateKey` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `basic` · object
          - `username` · string · required
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
      - `jdbcProperties` · map
        "A map of [properties](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Properties.html) passed to the JDBC driver to configure behavior. Refer to the documentation of your specific connection type for additional available JDBC properties to add to your connection configuration. This should only contain unencrypted properties, all values specified here are sent unencrypted to Foundry."
    - `databricks` · object
      "The configuration needed to connect to a [Databricks external system](/docs/foundry/available-connectors/databricks). Refer to the [official Databricks documentation](https://docs.databricks.com/aws/en/integrations/compute-details) for more information on how to obtain connection details for your system."
      - `hostName` · string · required
        "The hostname of the Databricks workspace."
      - `httpPath` · string · required
        "The Databricks compute resource’s HTTP Path value."
      - `authentication` · union · required
        "The method of authentication to use."
        - `workflowIdentityFederation` · object
          "Authenticate as a service principal using workload identity federation. This is the recommended way to connect to Databricks. Workload identity federation allows workloads running in Foundry to access Databricks APIs without the need for Databricks secrets. Refer to our [OIDC documentation](/docs/foundry/data-connection/oidc) for an overview of how OpenID Connect is supported in Foundry. A service principal federation policy must exist in Databricks to allow Foundry to act as an identity provider. Refer to the [official documentation](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation) for guidance."
          - `servicePrincipalApplicationId` · string
            "The ID of the Databricks [service principal](https://docs.databricks.com/aws/en/admin/users-groups/service-principals). If provided, a federated JWT token is exchanged using a service principal federation policy. If not provided, a federated JWT token is exchanged using an account federation policy."
          - `issuerUrl` · string · required
            "Identifies the principal that issued the access token as a string URI."
          - `audience` · string · required
            "Identifies the recipients that the access token is intended for as a string URI. This should be the primary host name where the Connection lives."
          - `subject` · string · required
            "The RID of the Connection that is connecting to the external system."
        - `oauthM2M` · object
          "Authenticate as a service principal using OAuth. Create a service principal in Databricks and generate an OAuth secret to obtain a client ID and secret. Read the [official Databricks documentation](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m) for more information about OAuth machine-to-machine authentication."
          - `clientID` · string · required
            "The client ID for the service principal."
          - `clientSecret` · union · required
            "The value of the client secret."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `personalAccessToken` · object
          "Authenticate as a user or service principal using a personal access token. Read the [official Databricks documentation](https://docs.databricks.com/aws/en/dev-tools/auth/pat) for information on generating a personal access token."
          - `personalAccessToken` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
        - `basic` · object
          - `username` · string · required
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
      - `jdbcProperties` · map
        "A map of [properties](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Properties.html) passed to the JDBC driver to configure behavior. Refer to the documentation of your specific connection type for additional available JDBC properties to add to your connection configuration. This should only contain unencrypted properties, all values specified here are sent unencrypted to Foundry."
    - `smb` · object
      - `hostname` · string · required
        "Any identifier that can resolve to a server hosting an SMB share. This includes IP addresses, local network names (e.g. FS-SERVER-01) or FQDNs. Should not include any protocol information like https://, smb://, etc"
      - `port` · integer
        "445 by default"
      - `proxy` · object
        "Egress proxy to pass all traffic through."
        - `hostname` · string · required
        - `port` · integer · required
        - `protocol` · enum · required
          one of `HTTP`, `SOCKS`
      - `share` · string · required
        "Must be a valid SMB share name. https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/dc9978d7-6299-4c5a-a22d-a039cdc716ea"
      - `baseDirectory` · string
        "All reads and writes in this source will happen in this subdirectory"
      - `auth` · union · required
        - `usernamePassword` · object
          - `username` · string · required
          - `password` · union · required
            "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
            - `asSecretName` · object
              - `value` · string · required
            - `asPlaintextValue` · object
              - `value` · string · required
          - `domain` · string
            "Optionally specify a Windows domain to use when authenticating. Normal DNS domain restrictions apply but the top-level domain might be something non-standard like .local. Defaults to WORKGROUP"
      - `requireMessageSigning` · boolean
        "If true, the client will request that the server sign all messages. If the server does not support message signing, the connection will fail. Defaults to true."
    - `jdbc` · object
      "The configuration needed to connect to an external system using the JDBC protocol."
      - `url` · string · required
        "The URL that the JDBC driver uses to connect to a database."
      - `driverClass` · string · required
        "The fully-qualified driver class name that is used to connect to the database."
      - `uploadedJdbcDrivers` · list
        "The list of uploaded JDBC driver names. To upload drivers to a JDBC connection, use the uploadCustomJdbcDrivers endpoint"
        - `JdbcDriverArtifactName` · string · required
          "The name of the uploaded JDBC artifact."
      - `jdbcProperties` · map
        "A map of [properties](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Properties.html) passed to the JDBC driver to configure behavior. Refer to the documentation of your specific connection type for additional available JDBC properties to add to your connection configuration. This should only contain unencrypted properties, all values specified here are sent unencrypted to Foundry."
      - `credentials` · object
        - `username` · string · required
        - `password` · union · required
          "When reading an encrypted property, the secret name representing the encrypted value will be returned. When writing to an encrypted property: - If a plaintext value is passed as an input, the plaintext value will be encrypted and saved to the property. - If a secret name is passed as an input, the secret name must match the existing secret name of the property and the property will retain its previously encrypted value."
          - `asSecretName` · object
            - `value` · string · required
          - `asPlaintextValue` · object
            - `value` · string · required

## Errors

- `ConnectionTypeNotSupported` (INVALID_ARGUMENT) — "The specified connection is not yet supported in the Platform API."
- `PropertyCannotBeBlank` (INVALID_ARGUMENT) — "The specified property cannot be blank."
- `ParentFolderNotFoundForConnection` (NOT_FOUND) — "The parent folder for the specified connection could not be found."
- `UnknownWorkerCannotBeUsedForCreatingOrUpdatingConnections` (INVALID_ARGUMENT) — "The UnknownWorker cannot be used for creating or updating connections. Please use the Foundry worker instead."
- `CreateConnectionPermissionDenied` (PERMISSION_DENIED) — "Could not create the Connection."
- `FolderNotFound` (NOT_FOUND) — "The given Folder could not be found."
- `ConnectionNotFound` (NOT_FOUND) — "The given Connection could not be found."
