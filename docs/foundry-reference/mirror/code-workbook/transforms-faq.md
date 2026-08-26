<!-- source: https://palantir.com/docs/foundry/code-workbook/transforms-faq/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Transforms FAQ

The following are some frequently asked questions about transforms.

For general information, see our [transforms documentation](/docs/foundry/code-workbook/transforms-overview/).

* [Is it possible to save a CSV file in `transforms-python` rather than saving Parquet?](#is-it-possible-to-save-a-csv-file-in-transforms-python-rather-than-saving-parquet)
* [Can I build multiple output datasets from one Python transform?](#can-i-build-multiple-output-datasets-from-one-python-transform)
* [How can I open a GZIP file with transforms?](#how-can-i-open-a-gzip-file-with-transforms)
* [How can I unzip a file as part of a Foundry pipeline? In parallel?](#how-can-i-unzip-a-file-as-part-of-a-foundry-pipeline-in-parallel)

***

## Is it possible to save a CSV file in `transforms-python` rather than saving Parquet?

Below are examples of how to do this in each transform language:

>

Java

```java
foundryOutput.getDataFrameWriter(dataFrame)
.setFormatSettings(DatasetFormatSettings.builder().format("csv").build())
.write();
```

>

Python

```python
from transforms.api import transform, Input, Output
@transform(
  output=Output("/path/to/python_csv"),
  my_input=Input("/path/to/input")
)
def my_compute_function(output, my_input):
  output.write_dataframe(my_input.dataframe(), output_format="csv")
```

>

SQL

```SQL
CREATE TABLE `/path/to/sql_csv` USING CSV AS SELECT * FROM `/path/to/input`
```

>

[Return to top](#transforms-faq)

***

## Can I build multiple output datasets from one Python transform?

If you want multiple transforms/datasets, you can create them using a `for` loop:

>

```python
from transforms.api import transforms_df, Input, Output

def transform_generator(sources):
	#type: (List[str]) -> List([transforms.api.Transform])
	transforms = []
		# This example uses multiple input datasets. You can also generate multiple outputs
		# from a single input dataset.
	for source in sources:
		@transforms_df(
			Output('/sources/{source}/output'.format(source=source)),
			my_input=Input('/sources/{source}/input'.format(source=source))
			)
		def compute_function(my_input, source=source):
			# To capture the source variable in the function, you pass it as a defaulted keyword argument.
			return my_input.filter(my_input.source == source)

		transforms.append(compute_function)

	return transforms

TRANSFORMS = transforms_generator(['src1', 'src2', 'src3'])
```

You can now import the `TRANSFORMS` attribute of the module and manually add each transform to your pipeline:

```python
import my_module

my_pipeline = Pipeline()
my_pipeline.add_transforms(*my_module.TRANSFORMS)
```

>

To have a single transform that takes in one input and outputs multiple datasets in the same build, you can also do this programmatically as below:

```python
# Using the `/examples/students_hair_eye_color` dataset
students_input = foundry.input('/examples/students_hair_eye_color')
students_input.dataframe().sort('id').show(n=3)
+---+-----+-----+----+
| id| hair|  eye| sex|
+---+-----+-----+----+
|  1|Black|Brown|Male|
|  2|Brown|Brown|Male|
|  3|  Red|Brown|Male|
+---+-----+-----+----+
Note that this example only shows the top three rows.

from transforms.api import transform, Input, Output

@transform(
	hair_eye_color=Input('/examples/students_hair_eye_color'),
	males=Output('/examples/hair_eye_color_males'),
	females=Output('examples/hair_eye_color_females'),
)
def brown_hair_by_sex(hair_eye_color, males, females):
	# type: (TransformInput, TransformOutput, TransformOutput) -> None
	brown_hair_df = hair_eye_color.dataframe().filter(hair_eye_color.dataframe().hair == 'Brown')

	males.write_dataframe(brown_hair_df.filter(brown_hair_df.sex == 'Male'))
	females.write_dataframe(brown_hair_df.filter(brown_hair_df.sex == 'Female'))

```

>

For more help and information on transforms, review the documentation for:

* [Python transforms](/docs/foundry/transforms-python/overview/)
* [Java transforms](/docs/foundry/transforms-java/overview/)
* [Spark SQL transforms](/docs/foundry/transforms-sql/spark-reference/)

[Return to top](#transforms-faq)

***

## How can I open a GZIP file with transforms?

Since the input to transforms is a file-like object that is backed by a stream, you can process it as a file. This means you do not need to be concerned about reading the whole file in to memory or copying it on to a disk, allowing for usage of much larger files.

Use the `gzip` and `io` packages included in Python 3:

```python
import gzip, io

def process_file(file_stauts):
	fs = input_dataset.filesystem()
	with fs.open(file_status.path, 'rb') as f:
		gz = gzip.GzipFile(fileobj=f)
		br = io.BufferedReader(gz)
```

And if you want reads to return strings, you can wrap it:

```python
tw = io.TextIOWrapper(br)
```

If your file has an encoding you can specify it:

```python
tw = io.TextIOWrapper(br, encoding='CP500')
```

For more help and information on transforms, review the documentation for:

* [Python transforms](/docs/foundry/transforms-python/overview/)
* [Java transforms](/docs/foundry/transforms-java/overview/)
* [Spark SQL transforms](/docs/foundry/transforms-sql/spark-reference/)

[Return to top](#transforms-faq)

***

## How can I unzip a file as part of a Foundry pipeline? In parallel?

This uses Java and Spark to unzip each file within the zip archive in a parallelized fashion. If you want to parallelize decompression within a single compressed file, use a splittable file format like `.bz2`.

```java
package com.palantir.transforms.java.examples;

import com.google.common.io.ByteStreams;
import com.palantir.transforms.lang.java.api.Compute;
import com.palantir.transforms.lang.java.api.FoundryInput;
import com.palantir.transforms.lang.java.api.FoundryOutput;
import com.palantir.transforms.lang.java.api.ReadOnlyLogicalFileSystem;
import com.palantir.transforms.lang.java.api.WriteOnlyLogicalFileSystem;
import com.palantir.util.syntacticpath.Paths;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * This is an example of unzipping files in parallel using Spark.
 * <p>
 * The work is distributed to executors.
 */
public final class UnzipWithSpark {

    @Compute
    public void compute(FoundryInput zipFiles, FoundryOutput output) throws IOException {
        ReadOnlyLogicalFileSystem inputFileSystem = zipFiles.asFiles().getFileSystem();
        WriteOnlyLogicalFileSystem outputFileSystem = output.getFileSystem();

        inputFileSystem.filesAsDataset().foreach(portableFile -> {
            // "processWith" gives you the InputStream for the given input file.
            portableFile.processWithThenClose(stream -> {
                try (ZipInputStream zis = new ZipInputStream(stream)) {
                    ZipEntry entry;
                    // For each file in the zip file, write it to the output file system.
                    while ((entry = zis.getNextEntry()) != null) {
                        outputFileSystem.writeTo(
                                Paths.get(entry.getName()),
                                outputStream -> ByteStreams.copy(zis, outputStream));
                    }
                    return null;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            });
        });
    }
}

```

For more help and information on transforms, review the documentation for:

* [Python transforms](/docs/foundry/transforms-python/overview/)
* [Java transforms](/docs/foundry/transforms-java/overview/)
* [Spark SQL transforms](/docs/foundry/transforms-sql/spark-reference/)

[Return to top](#transforms-faq)
