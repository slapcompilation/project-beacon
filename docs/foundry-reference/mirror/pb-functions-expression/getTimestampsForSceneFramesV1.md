<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/getTimestampsForSceneFramesV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get timestamps for scene frames

> Supported in: Batch

Get the timestamps and scene scores for detected scene frame transitions in the video.

**Expression categories:** Media

## Declared arguments

* **Media reference:** The video from which scene frame timestamps are extracted.<br>*Expression\<Media reference>*
* *optional* **Scene sensitivity:** Controls how easily scene changes are detected. Higher sensitivity detects more subtle transitions.<br>*Enum\<Less sensitive, More sensitive, Standard>*

**Output type:** *Array\<Struct\<timestamp:String, scene\_score:String>>*
