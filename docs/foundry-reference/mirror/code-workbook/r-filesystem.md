<!-- source: https://palantir.com/docs/foundry/code-workbook/r-filesystem/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# R Filesystem API

## R `TransformInput` object

The interface for low level operations on a Foundry dataset.

**`spark.df()`**

* Returns a [pyspark.sql.DataFrame ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) of the input dataset.

**`data.frame()`**

* Returns an [R data.frame ↗](https://www.rdocumentation.org/packages/base/versions/3.5.1/topics/data.frame) of the input dataset.

**`fileSystem()`**

* Returns a *FileSystem* object for direct *FoundryFS* access.

## R `TransformOutput` object

The interface for low level write operations on a Foundry dataset.

**`write.spark.df`(*df*, *partition\_cols=NULL*, *bucket\_cols=NULL*, *bucket\_count=NULL*, *sort\_by=NULL*)**

* Write the given [DataFrame ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) to the output dataset.

    <table>
    <tr>
        <td><b>Parameters</b></td>
        <td><ul>
            <li><b>df</b> (<i><a href="https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html">pyspark.sql.DataFrame</a></i>) –  The PySpark dataframe to write.</li>
            <li><b>partition_cols</b> (<i>List[str], optional</i>) - Column partitioning to use when writing data.</li>
            <li><b>bucket_cols</b> (<i>List[str], optional</i>) - The columns by which to bucket the data. Must be specified if bucket_count is given.</li>
            <li><b>bucket_count</b> (<i>int, optional</i>) – The number of buckets. Must be specified if bucket_cols is given.</li>
            <li><b>sort_by</b> (<i>List[str], optional</i>) - The columns by which to sort the bucketed data.</li>
        </ul></td>
    </tr>
    </table>

**`write.data.frame`(*rdf*)**

* Writes the given [R data.frame ↗](https://www.rdocumentation.org/packages/base/versions/3.5.1/topics/data.frame) to the output dataset.

**`fileSystem()`**

* Returns a *FileSystem* object for direct *FoundryFS* access.

## R `FileSystem` object

**`ls`(*glob=NULL*, *regex='.\*'*, *show\_hidden=FALSE*)**

* Lists all files matching the given pattern (either `glob` or `regex`), with respect to the root directory of the dataset.

    <table>
    <tr>
        <td><b>Parameters</b></td>
        <td><ul>
            <li><b>glob</b> (<i>str</i>, <i>optional</i>) – A unix file matching pattern. Also supports globstar.</li>
            <li><b>regex</b> (<i>str</i>, <i>optional</i>) – A regex pattern against which to match filenames.</li>
            <li><b>show_hidden</b> (<i>bool</i>, <i>optional</i>) – Include hidden files, those prefixed with ‘.’ or ‘_’.</li>
        </ul></td>
    </tr>
    <tr>
        <td><b>Returns</b></td>
        <td>R array of the FileStatus named tuple (path, size, modified) - The logical path, file size (bytes), modified timestamp (ms since January 1, 1970 UTC)</td>
    </tr>
    </table> 

**`open`(*path*, *open='r'*, *disk\_optimal=FALSE*, *encoding=default*)**

* Open a FoundryFS file in the given mode.

    <table>
    <tr>
        <td><b>Parameters</b></td>
        <td><ul>
            <li><b>path</b> (<i>str</i>) – The logical path of the file in the dataset. (<b>Remote path</b>)</li>
            <li><b>open</b> (<i>str</i>) - A description of the <a href="https://www.rdocumentation.org/packages/base/versions/3.5.1/topics/connections">mode</a> in which to open the connection.
            <li><b>disk_optimal</b> (<i>bool</i>, <i>optional</i>) – Controls how FoundryFileSystem handles file i/o.
            <li><b>encoding</b> (<i>str</i>, <i>optional</i>) - Defaults to the R language default (UTF-8).
        </ul></td>
    </tr>
    <tr>
        <td><b>Returns</b></td>
        <td>An R connection object
    </td>
    </tr>
    </table>

**`get_path`(*path*, *open='r'*, *disk\_optimal=FALSE*, *encoding=default*)**

* For a given FoundryFS (remote) path, returns the local temporary path.

    <table>
    <tr>
        <td><b>Parameters</b></td>
        <td><ul>
            <li><b>path</b> (<i>str</i>) – The logical path of the file in the dataset. (<b>Remote path</b>)</li>
            <li><b>open</b> (<i>str</i>) - A description of the <a href="https://www.rdocumentation.org/packages/base/versions/3.5.1/topics/connections">mode</a> in which to open the connection.
            <li><b>disk_optimal</b> (<i>bool</i>, <i>optional</i>) – Controls how FoundryFileSystem handles file i/o.
            <li><b>encoding</b> (<i>str</i>, <i>optional</i>) - Defaults to the R language default (UTF-8).
        </ul></td>
    </tr>
    <tr>
        <td><b>Returns</b></td>
        <td><i>str</i>
    </td>
    </tr>
    </table>

**`upload`(*local\_path*, *remote\_path*)**

* Upload the file from the local to the remote path. Write only.

    <table>
    <tr>
        <td><b>Parameters</b></td>
        <td><ul>
            <li><b>local_path</b> (<i>str</i>) – The local path of the file to upload.</li>
            <li><b>remote_path</b> (<i>str</i>) - The logical path of the file in the dataset.</li>
        </ul></td>
    </tr>
    <tr>
        <td><b>Returns</b></td>
        <td><i>None</i>
    </td>
    </tr>
    </table>

## Advanced topic: `disk_optimal` setting

In the `FileSystem` methods `open()` and `get_path()`, the `disk_optimal` argument controls how file input and output (i/o) is handled.

By default, `disk_optimal` is set to `FALSE` in both `open()` and `get_path()`. In this mode, files are guaranteed to be downloaded before they are accessed.

If you choose to set `disk_optimal` to `TRUE`, files are downloaded simultaneously while the code executes. The temporary local path must be opened via `fifo()` in order to read correctly. Note that not all libraries support reading this type of file.

You may choose to set `disk_optimal` to `TRUE` when the file you are reading is very large.

For example, imagine you have a very large txt file and you only want to read the first 10 lines. Use the below code to print only the first 10 lines, without reading the entire file.

```r
disk_optimal_example<- function(large_txt_file) {
    fs <- large_txt_file$fileSystem()

    ## Open a connection with fifo()
    ## The text file is titled large_txt_file.txt
    conn <- fs$open("large_txt_file.txt", "r", disk_optimal = TRUE)

    A <- readLines(conn, n = 10)
    print(A)
    return(NULL)    
}
```

If you want to use R TransformOutput to write a file and then read it, `disk_optimal` must be set to false.
