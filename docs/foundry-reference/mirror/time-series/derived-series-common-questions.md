<!-- source: https://palantir.com/docs/foundry/time-series/derived-series-common-questions/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# FAQ

## Which Quiver cards are supported in derived series logic?

The following [Quiver cards](/docs/foundry/quiver/cards-index-time-series/) are supported in derived series logic:

* Object time series property
* Filter time series
* Derivative
* DSP filter
* Integral
* Sample
* Segment statistics
* Time series formula
* Combine time series
* Cumulative aggregate
* Periodic aggregate
* Rolling aggregate
* Relative time series
* Shift time series
* Shift date/time
* Numeric parameter
* String parameter
* Date/time parameter
* Date/time range parameter
* Duration unit parameter
* Boolean parameter

## Why did I receive an error for multiple root objects?

If you receive an error for multiple root objects in the Quiver creation dialog, your analysis likely started from a sensor object type and used two different individual objects for comparison. For example, you may have pulled and compared the sensor objects `Inlet pressure` and `Outlet pressure` from the sensor object type instead of the `Machine 1` root object type. To create a derived series, you will need to start from the root object instance.

Review the [logic requirements for setting up a templated derived series](/docs/foundry/time-series/derived-series-overview/#logic-for-templated-derived-series) to learn why derived series must be generated from the perspective of a root object.

## Can I apply the same derived series template to different objects?

Yes. The logic and calculations are templated so results can be calculated from the perspective of any bound object with the same object type. Review the section on [storing derived series in the Ontology](/docs/foundry/time-series/derived-series-create/#6-configure-ontology-saving-options), and notice that the same codex template is applied to different `Machine` objects or sensor objects.

## What is the difference between the codex template RID and the derived series RID in the URL?

The derived series RID is for the Quiver resource that holds the resource name, description, and other metadata. The codex template RID listed on the **Derived series management** page is a reference to the template logic used when the derived series data is calculated at runtime. Review the section on [storing derived series in the Ontology](/docs/foundry/time-series/derived-series-create/#6-configure-ontology-saving-options) for more details.

## How can I reference a specific version of derived series logic in a TSP?

To reference a specific version of logic, your TSP value should look like the following:

```
{"templateRid":"ri.codex-emu.main.template.8da5f759-4b...","templateVersion":"0.0.x"}
```

## If my input series changes, does the derived series update accordingly?

Since derived series are calculated at read time, the derived series will show any updates to the input series that are available. For example, any change to the input series that are visible in Quiver will also be reflected in the derived series.

## Can I use my derived series as an input to another derived series?

Yes, derived series can be nested and used to calculate another derived series. You can use the derived series in the same way you would use a raw time series. Make sure to follow the [derived series creation requirements](/docs/foundry/time-series/derived-series-overview/#requirements) so that the new derived series functions as expected.

## When I update the logic of a derived series, will applications that consume that derived series also update accordingly?

Derived series offer the advantage of immediate logic updates without consuming pipeline resources. Applications that render the derived series (usually a Quiver analysis or a Quiver dashboard embedded in an application) will calculate the derived series using the updated templated logic.

## Can a TSP contain both derived series and non-derived time series?

Yes! A TSP can have a mix of values which are either a series ID for (non-derived) time series or Codex template RIDs for derived series. This is typically used with a [sensor object type](/docs/foundry/time-series/time-series-concepts-glossary/#sensor-object-type). If your TSP is backed by multiple syncs and contains derived series, your Codex template RID for the derived series should **not** be in the qualified series ID format.
