<!-- source: https://palantir.com/docs/foundry/object-explorer/generate-urls/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Generate Object Explorer URLs

In the course of developing object views, or when integrating object views into Slate applications or external systems, you may need to generate URLs that link to a specific object or search for objects.

To learn about how to create a URL linking to a specific Object View, see [Generating Object Views URLs](/docs/foundry/object-views/generate-urls/) in the Object Views documentation.

## Generating a keyword-only search

If your text contains special character or spaces, you will need to encode it:

`encodeURIComponent("hello world");`

Create a URL:

`<BASEURL>/hubble/external/keyword/v0/<MY_ENCODED_TEXT>`

## Linking to explorations

Object Explorer can open links to specific object types, saved explorations, or new searches with filters described in the URL. Each type of link can be opened in the default Explore view, with charts showing aggregate results, or in the tabular Results view by appending the parameter `perspectiveId=results` to the end of the link URL.

**Opening an object type For exploration**

Explorations for specific object types can be opened with the `objectTypeId` URL parameter. For example:

`/workspace/hubble/exploration?objectTypeId=aircraft`.

To open in the Results view, append the `perspectiveId=results` parameter:

`/workspace/hubble/exploration?objectTypeId=aircraft&perspectiveId=results`

**Loading a Saved Exploration or Object Set**

Use the `saved` route to open a saved exploration or object set.

`/workspace/hubble/exploration/saved/ri.object-set.main.versioned-object-set.4b117663-06d7-4bd1-a2be-8e1ba20998cb`

To load an object set created by another Foundry application, use the `external/objectSet` route.

`/workspace/hubble/external/objectSet/v0/ri.object-set.main.object-set.f6916120-5b52-4312-8be4-9f5764983907`

## \[Advanced] Generating a complex search

Generate your set of filters to look like:

```json
{
  "keyword": "",
  "objectTypes": [
    "google-reviews"
  ],
  "filters": [
    {
      "type": "propertyFilter",
      "objectType": "google-reviews",
      "propertyType": "Description",
      "value": {
          "type": "textFilter",
          "text": "hello"
      }
    },
    {
      "type": "propertyFilter",
      "objectType": "google-reviews",
      "propertyType": "rating",
      "value": {
          "type": "valuesFilter",
          "values": ["3", "4"]
      }
    },
    {
      "type": "propertyFilter",
      "objectType": "google-reviews",
      "propertyType": "creation-date",
      "value": {
          "type": "dateRangeFilter",
          "dateRangeFilter": {
              "start": "2000-01-10",
              "end": "2000-01-11"
          }
      }
    },
    {
      "type": "linkFilter",
      "objectType": "google-reviews",
      "linkType": "restaurant-to-review",
      "value": {
          "type": "presenceFilter",
          "matchType": "MUST_HAVE"
      }
    }
  ]
}
```

There are more types of filters available, including:

* **numberRangeFilter:** `min` (optional number), `max` (optional number)
* **relativeDateFilter:** `sinceDaysAgo` (optional number), `untilDaysAgo` (optional number)
* **timestampRangeFilter:** `startMillis` (optional number), `endMillis` (optional number)
* **relativeTimestampFilter:** `sinceMillisAgo` (optional number), `untilMillisAgo` (optional number)

:::callout{theme="neutral"}
This example may be out of date – use the instructions below to find out the latest format.
:::

The type of the value must match the type of widget that shows by default for that property in Object Explorer. For example: `valuesFilter` for a histogram widget; `textFilter` for textbox.

The recommended way to generate these filters is:

1. Open Object Explorer and build an example search, with sample values chosen for all the filters you wish to generate

2. Open the Chrome Console (*right click* -> *inspect element*). Make sure you inspect an element that Object Explorer provides, such as the resulting count, rather than just opening the Chrome Console.

3. Run `await hubble_get_current_search()` in the console.

This will return the JSON for your current set of filters, which you can use to work out the correct format, and add substitutions for the values.

:::callout{theme="neutral"}
You can have many *PROPERTY* filters, but only 1 *LINK* filter.
:::

4. URL encode it:

`encodeURIComponent(<MY_FILTERS>);`

5. Create a URL:

`<BASEURL>/hubble/external/search/v2/{<ENCODED-URL-FROM-ABOVE>}`
