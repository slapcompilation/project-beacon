<!-- source: https://palantir.com/docs/foundry/workshop/widgets-audio-preview/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Audio and Transcription Display widget

![An example Audio and Transcription Display widget, showing a visualization of the audio and a transcript.](/docs/resources/foundry/workshop/audio_display_widget_example.png)

The audio and transcription display widget visualizes and allows the playback of audio based on a [media reference](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references) property on an object. It can also be used to display and interact with transcriptions using an object set containing transcription segments.

To capture audio directly within Workshop, use the [Audio Recorder widget](/docs/foundry/workshop/widgets-audio-recorder/), which uploads recordings to a media reference or media set that you can then play back and visualize here.

In contrast to the [Media Preview widget](/docs/foundry/workshop/widgets-media-preview/), the Audio and Transcription Display widget provides additional audio-specific configuration options, such as timestamp-driven behavior.
The transcription component provides the following features:

* Aligned playback between the audio player and transcription view
* Speaker display for easy navigation to speakers of interest
* Action configuration options for advanced functionality, such as transcript editing

## Configuration options

### Audio

![Audio display configuration options for the Audio and Transcription Display widget.](/docs/resources/foundry/workshop/audio_display_config_audio.png)

* **Object set with a single object:** An object with a media reference property.
* **Audio media reference property:** The [media reference](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references) object property that is an audio media reference.
* **Seek to timestamp (seconds):** An optional numeric variable that seeks the audio to a specific timestamp.
  * If the given number is greater than the length of the audio, it will seek to the end of the audio.
  * If the given number is less than zero, it will seek to the beginning of the audio.
  * Playback will work as normal on user interaction.

### Transcription (optional)

![Transcription configuration options for the Audio and Transcription Display widget.](/docs/resources/foundry/workshop/audio_display_config_transcription.png)

* **Enable transcription:** Optionally display interactive transcription above the audio.
  * **Segments object set:** An object set containing segments that include selected properties.
  * **Transcription contents:** The string object property containing the segment text.
  * **Beginning timestamp (milliseconds):** The numeric object property containing the segment's beginning timestamp in milliseconds.
  * **End timestamp (milliseconds):** The numeric object property containing the segment's end timestamp in milliseconds.
  * **Speaker diarization:** Toggle to enable or disable the Gantt chart speaker display.
    * **Speaker:** The string object property containing the speaker name or ID.
    * **Diarization display:** Select between **Player** and **Gantt** visualization options.
  * **Enable actions:** Enable actions that will appear in a toolbar when a segment is hovered over.
    * **Icon:** Choose an icon to represent this action in the toolbar. If no icon is set, a pencil icon will be used by default.
    * **Action label:** Set the name for the action that will display in the tooltip of the icon.
    * **Action:** Set an action that can be triggered from the segment toolbar. The hovered segment may be referenced using the `Selected segment` variable. For more information on actions, review our [action type documentation](/docs/foundry/action-types/overview/).
