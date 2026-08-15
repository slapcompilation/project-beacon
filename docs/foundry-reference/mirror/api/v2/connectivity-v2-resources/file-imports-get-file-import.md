<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/file-imports/get-file-import/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get File Import

`GET /api/v2/connectivity/connections/{connectionRid}/fileImports/{fileImportRid}`

Get the FileImport with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-file-import-read`.

Scopes: `api:connectivity-file-import-read`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."
- `fileImportRid` · string · required
  "The Resource Identifier (RID) of a FileImport (also known as a batch sync)."

## Response

- `FileImport` · object · required
  - `rid` · string · required
    "The Resource Identifier (RID) of a FileImport (also known as a batch sync)."
  - `connectionRid` · string · required
    "The RID of the Connection (also known as a source) that the File Import uses to import data."
  - `datasetRid` · string · required
    "The RID of the output dataset. Can not be modified after the file import is created."
  - `branchName` · string
    "The branch name in the output dataset that will contain the imported data. Defaults to `master` for most enrollments. Can not be modified after the file import is created."
  - `displayName` · string · required
  - `fileImportFilters` · list
    "Use filters to limit which files should be imported. Filters are applied in the order they are defined. A different ordering of filters may lead to a more optimized import. [Learn more about optimizing file imports.](/docs/foundry/data-connection/file-based-syncs/#optimize-file-based-syncs)"
    - `FileImportFilter` · union · required
      "[Filters](/docs/foundry/data-connection/file-based-syncs/#filters) allow you to filter source files before they are imported into Foundry."
      - `pathNotMatchesFilter` · object
        "Only import files whose path (relative to the root of the source) does not match the regular expression. **Example** Suppose we are importing files from `relative/subfolder`. `relative/subfolder` contains: - `relative/subfolder/include-file.txt` - `relative/subfolder/exclude-file.txt` - `relative/subfolder/other-file.txt` With the `relative/subfolder/exclude-.*.txt` regex, both `relative/subfolder/include-file.txt` and `relative/subfolder/other-file.txt` will be imported, and `relative/subfolder/exclude-file.txt` will be excluded from the import."
        - `regex` · string · required
          "Must be written to match the paths relative to the root of the source, even if a subfolder is specified."
      - `anyPathMatchesFilter` · object
        "If any file has a relative path matching the regular expression, sync all files in the subfolder that are not otherwise filtered."
        - `regex` · string · required
          "The regular expression for the relative path to match against."
      - `filesCountLimitFilter` · object
        "Only retain `filesCount` number of files in each transaction. The choice of files to retain is made without any guarantee of order. This option can increase the reliability of incremental syncs."
        - `filesCount` · integer · required
          "The number of files to import in the transaction. The value specified must be positive."
      - `changedSinceLastUploadFilter` · object
        "Only import files that have changed or been added since the last import run. Whether or not a file is considered to be changed is determined by the specified file properties. This will exclude files uploaded in any previous imports, regardless of the file import mode used. A SNAPSHOT file import mode does not reset the filter."
        - `fileProperties` · list
          "The criteria on which to determine whether a file has been changed or not since the last import. If any of the specified criteria have changed, the file is consider changed. The criteria include: LAST_MODIFIED: The file's last modified timestamp has changed since the last import. SIZE: The file's size has changed since the last import. If no criteria are specified, only newly added files will be imported."
          - `FileProperty` · enum · required
            one of `LAST_MODIFIED`, `SIZE`
      - `customFilter` · object
        "A custom file import filter. Custom file import filters can be fetched but cannot currently be used when creating or updating file imports."
        - `config` · any · required
      - `lastModifiedAfterFilter` · object
        "Only import files that have been modified after a specified timestamp"
        - `afterTimestamp` · string
          "Timestamp threshold, specified in ISO-8601 format. If not specified, defaults to the timestamp the filter is added to the file import."
      - `pathMatchesFilter` · object
        "Only import files whose path (relative to the root of the source) matches the regular expression. **Example** Suppose we are importing files from `relative/subfolder`. `relative/subfolder` contains: - `relative/subfolder/include-file.txt` - `relative/subfolder/exclude-file.txt` - `relative/subfolder/other-file.txt` With the `relative/subfolder/include-.*.txt` regex, only `relative/subfolder/include-file.txt` will be imported."
        - `regex` · string · required
          "Must be written to match the paths relative to the root of the source, even if a subfolder is specified."
      - `atLeastCountFilter` · object
        "Import all filtered files only if there are at least the specified number of files remaining."
        - `minFilesCount` · integer · required
          "The minimum number of files remaining expected. The value specified must be greater than 0."
      - `fileSizeFilter` · object
        "Only import files whose size is between the specified minimum and maximum values. At least one of `gt` or `lt` should be present. If both are present, the value specified for `gt` must be strictly less than `lt - 1`."
        - `gt` · string
          "File size must be greater than this number for it to be imported. The value specified cannot be a negative number."
        - `lt` · string
          "File size must be less than this number for it to be imported. The value specified must be at least 1 byte."
  - `importMode` · enum · required
    one of `SNAPSHOT`, `APPEND`, `UPDATE`
    "Import mode governs how raw files are read from an external system, and written into a Foundry dataset. SNAPSHOT: Defines a new dataset state consisting only of files from a particular import execution. APPEND: Purely additive and yields data from previous import executions in addition to newly added files. UPDATE: Replaces existing files from previous import executions based on file names."
  - `subfolder` · string
    "A subfolder in the external system that will be imported. If not specified, defaults to the root folder of the external system."

## Errors

- `FileImportNotFound` (NOT_FOUND) — "The given FileImport could not be found."
