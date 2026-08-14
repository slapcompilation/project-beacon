<!-- source: https://palantir.com/docs/foundry/transforms-python/environment-creation-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Environment creation overview

:::callout{theme="neutral"}
This is an advanced guide that goes into detail about the environment initialization process. It is intended for users who are interested in the technical considerations that can affect initialization performance. For general guidance regarding common environment-related issues, see the [Environment troubleshooting guide](/docs/foundry/transforms-python/environment-troubleshooting/).
:::

Conda is an open-source language-agnostic package and environment manager. Mamba is an open-source re-implementation of the Conda package manager. Hawk is a Palantir-developed re-implementation of the Conda package manager. Code Repositories uses Hawk to resolve package dependencies when running Checks after a Commit. Hawk offers several advantages in package resolution over Mamba and Conda, most notably in increased speed and active maintenance and development.

This page introduces the most important concepts and outlines the environment creation process; for more information, consult the [official Conda documentation ↗](https://docs.conda.io/en/latest/) and [Mamba documentation ↗](https://github.com/mamba-org/mamba).

## Important Terms

### Package

A **package** is a collection of files that commonly contains metadata, libraries, and/or binaries. Code Repository provides access to a broad selection of packages (`numpy`, for example) to supplement the core language features.

A package is *versioned*, and nearly always has a set of dependencies—other packages that must also be installed for it to function properly. A dependency might be a specific version of a package, a range of acceptable versions, or any version at all.

### Channel

A **channel**, sometimes called a repository, is any location where packages are stored. One channel might be a directory in the local file system, and another might be a directory hosted on a web server.

Regardless of type, each channel is a directory tree that separates packages by platform architecture. Each platform subdirectory contains a file called `repodata.json`, which is an index of all packages in that subdirectory.

Conda searches a set of pre-configured channels whenever it needs to fetch a package. For more information about channel management in Foundry, see the [packages documentation](/docs/foundry/transforms-python/use-python-libraries/).

### Environment

A Conda **environment** is a directory that contains a specific collection of packages. An environment is created for each repository by passing the packages specified in the **Environment Configuration** panel to Conda. Conda constructs a set of packages that satisfies the configuration and all dependencies, and installs these packages onto the Spark module that backs the repository.

## Performance

The following explanation of performance draws on [this Anaconda blog post ↗](https://www.anaconda.com/blog/understanding-and-improving-condas-performance), which discusses Conda performance at length, but will similarly apply to a Mamba or Hawk implementation. The next two sections summarize this material and outline the performance factors that are most relevant to Code Repositories:

* [Creating an environment](#creating-an-environment)
* [Limitations](#limitations)

### Creating an environment

Environment creation comprises two major steps: the [solve step](#solve-step) and the [install step](#install-step).

#### Solve step

In the *solve step*, the designated package manager, either Conda, Mamba, or Hawk, attempts to find packages and versions that satisfy all transient dependencies. Transient dependencies comprise the dependencies of the packages specified in the **Environment Configuration** panel, those dependencies' dependencies, and so on. This step contains four stages:

1. Download and process package indices. The package manager will download relevant `repodata.json` files from each configured channel, and will convert the index entries into objects in memory.
2. Reduce the index. The package manager builds up a set of all packages that could possibly be used for the environment. To do this, the algorithm begins with the provided package specification and recurses through all dependencies. All unneeded packages—primarily those that are not in the dependency graph—are pruned away.
3. Express dependency constraints as a Boolean satisfiability (SAT) problem. Package managers prefer certain types of solutions, such as the newest possible versions of packages, and these biases are baked into clause construction.
4. Run the SAT solver.

#### Install step

If the solve succeeds, the *install step* is next. Here, each artifact is retrieved from the proper channel and the package manager uses these artifacts to construct the environment. This step contains three stages:

1. Download and extract all packages in the solved environment.
2. Verify package contents. Depending on configuration, Conda will either use a checksum or will verify that the file size is correct.
3. Link packages into the environment.

### Limitations

All of the steps outlined above can be susceptible to slowness in certain situations. Causes of slowness usually fall into one of three categories:

* [Upstream changes](#upstream-changes)
* [Environment specification](#environment-specification)
* [Package size](#package-size)

#### Upstream changes

A significant portion of slowness is caused by factors external to Foundry.

* Downloading and processing channel indices scale with total size of index files; the more channels that are needed to consider and the larger these channels are, the longer these steps will take.
* Index reduction also scales with the number of transitive dependencies; the number of transitive dependencies is determined by which dependencies packages choose to declare.

Because these factors are external and opaque, it can be difficult to perform root cause analysis on performance regressions. An environment may suddenly take longer to load because a channel recently increased in size, or because a package declared several new dependencies in its newest release.

#### Environment specification

More commonly, slow initialization is directly tied to the **environment specification** itself. The solve step scales superlinearly with environment size, so as a general rule of thumb, environments with more packages will take disproportionately longer to initialize.

There are two ways to remediate these situations.

* First, remove unneeded packages from the environment definition. It is much more performant to have small, specialized environments than to have large, general-purpose ones.
* Second, try adding version constraints to some of the packages in the **Environment Configuration** panel. It is most effective to pin versions for packages with many extant builds like `python` and for packages with complex dependency graphs like `scipy`. Doing so will allow Conda to more aggressively reduce the indices, meaning that the SAT solve will not need to account for as many package versions.

#### Package size

**Package size** is typically less problematic than the other factors in this section, but it is still relevant in some cases.

Downloading and extracting even a single package may not be trivial. For example, the `pytorch` package is about 460 MB in size, and can take 35+ seconds to extract.

Download, extraction, and verification all scale linearly with the size and number of packages in the environment. Due to transitive dependencies, the solved environment typically contains many more packages than were explicitly specified in the environment definition, and the increase in packages may cause slowness.

Remediation in this case is similar to the suggestions for [environment specification](#environment-specification): try to keep environments as small as possible.
