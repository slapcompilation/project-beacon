-- 696: Quiver — an analysis is a TYPE-CHECKED graph of cards.
--
--   "Quiver provides a point-and-click interface to perform data analysis on object and time series data from the Ontology."
--   — quiver/overview.md
--
-- THE TYPE SYSTEM IS THE DESIGN. Everything else in this file exists to
-- serve it:
--
--   "Every card in Quiver can take zero or more inputs and produces an output of a specific type."
--   — quiver/analysis-data-model.md
--
--   "A card can only be added as an input to another card if that card's output type is equal to the downstream card's input type."
--   — quiver/analysis-data-model.md
--
-- so quiver_card_inputs is guarded by the catalogue rather than by a shape
-- we invented, and a mismatch is refused with both type names. The page's
-- own worked example is the acceptance test at the bottom of this file: a
-- filter object set cannot feed an object property, because one emits an
-- object set and the other consumes a single object, and an OBJECT SELECTOR
-- is the card that converts between them. Conversion is a card here too.
--
-- THE CANVAS IS NOT THE GRAPH, which is the sentence that stops the obvious
-- wrong modelling:
--
--   "Unlike a Contour path, a Quiver canvas is used for display and organization only. Rearranging cards in your canvas will not affect the underlying sequence of data transformation."
--   — quiver/analysis-canvas.md
--
-- Canvas membership is therefore a join table carrying geometry, and a card
-- with no row in it is legal — the page names that state:
--
--   "The card will appear in the **Not in canvas** section of the **Analysis Contents** panel, where it can be configured, added back to a canvas, or deleted."
--   — quiver/analysis-canvas.md
--
-- PERMISSIONS NEED NOTHING NEW, and the page says so outright:
--
--   "The permissions for a Quiver analysis are derived from its Project in the Foundry file system."
--   — quiver/analysis-save-share.md
--
-- so there is no Quiver grant table below; project_role decides, composed
-- rather than restated. Link sharing is a second mechanism on top of that
-- and is NOT built here.
--
-- THE CATALOGUE IS AN INDEX, not 203 stubs — the fourth instance of the
-- pattern after workshop_widget_kinds, slate_widget_kinds and
-- fusion_cell_types. Every one of the section's 203 card pages declares its
-- own `## Input type` and `## Output type`; quiver_card_kinds() below is
-- those declarations, parsed, so an unbuilt kind refuses BY NAME instead of
-- rendering blank. Twelve are built, chosen to reproduce the data model
-- page's worked example end to end without needing a time series store,
-- which this platform does not have.
--
-- WHERE FOUNDRY DISAGREES WITH ITSELF, THE ENUMERATION WINS. Individual card
-- pages spell types `Object`, `Date`, `Time ranges`, `Number range` and
-- `None`; analysis-data-model's table — the page that LISTS the set — says
-- `Single object`, `Time`, `Time range`, `Numeric range` and `Flow start`.
-- The catalogue is normalised to that table. Four tokens map to nothing in
-- it at all (`Time series array`, `Enum time series`, `Materialization SQL`,
-- `Time series scatter plot regression`) and three card pages declare no
-- signature at all (align-series-to-event-set, backing-object-from-time-
-- series, grouped-time-series-plot); all seven are recorded in the note
-- column rather than guessed. Every one of them is unbuilt.

-- ── the twenty-eight types ──────────────────────────────────────────────────

CREATE FUNCTION public.quiver_data_types()
RETURNS TABLE (data_type text, description text)
LANGUAGE sql IMMUTABLE AS $$
  -- analysis-data-model's own table, in its own order, with its own wording
  SELECT t.data_type::text, t.description::text FROM (VALUES
    ('Object set',          'A set of objects backed by the Ontology. Useful for simple, responsive analysis at medium scale.'),
    ('Single object',       'A single object in the Ontology.'),
    ('Categorical chart',   'A chart consisting of (string, number) or (string, string, number) values.'),
    ('Object selection',    'A card that supports selecting objects through interaction.'),
    ('Pivot table',         'Tabular data resulting from a pivot table aggregation.'),
    ('Ontology SQL',        'A SQL query result from querying ontology object data. Can be converted to a transform table for further analysis.'),
    ('Transform table',     'A local table used for flexible, low scale analysis. Can be used to transform, edit, or convert between different data types.'),
    ('Materialization',     'A dataset-backed materialization of objects used for flexible, high scale analysis.'),
    ('Time series',         'A time series consisting of (value, timestamp) "ticks".  Useful for high frequency, time-based analysis.'),
    ('Time series chart',   'An interactive, time-based chart that can visualize time series, time ranges, event sets, and points in time.'),
    ('Time series group',   'A group of time series that can be visualized or transformed together.'),
    ('Bounded time series', 'A region bounded by an upper time series and a lower time series.'),
    ('Event set',           'A set of events with start and end times.'),
    ('Time scatter plot',   'Data returned from a time series scatter plot.'),
    ('String',              'A single string value.'),
    ('Number',              'A single numeric value.'),
    ('Time',                'A single date/time value.'),
    ('Boolean',             'A single boolean value.'),
    ('Duration unit',       'A unit of time (millisecond, second, minute, hour, day, week).'),
    ('String array',        'An array of string values.'),
    ('Number array',        'An array of numeric values.'),
    ('Time array',          'An array of date/time values.'),
    ('Boolean array',       'An array of boolean values.'),
    ('Numeric range',       'A range consisting of a starting numeric value and an ending numeric value.'),
    ('Time range',          'A range consisting of a starting date/time value and an ending date/time value.'),
    ('X/Y range',           'A set of two ranges, used to create a "box" on a chart.'),
    ('Flow start',          'Indicator that a card does not take any inputs.'),
    ('Flow end',            'Indicator that a card does not produce an output type.')
  ) AS t(data_type, description)
$$;
COMMENT ON FUNCTION public.quiver_data_types() IS
  'The twenty-eight types quiver/analysis-data-model enumerates in one table, which is what "Together, these types form Quiver''s data model, and define how cards can be chained together" refers to. Two of them are arity markers rather than data, which is how a card with no input or no output still types. This enumeration WINS over any single card page that spells a member differently.';

-- ── the catalogue: every card page's declared signature ─────────────────────

CREATE FUNCTION public.quiver_card_kinds()
RETURNS TABLE (kind text, title text, input_types text[], output_types text[],
               built boolean, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- Parsed from the `## Input type` / `## Output type` sections of all 203
  -- card-*.md pages, normalised to quiver_data_types(). `built` is ours.
  SELECT t.kind::text, t.title::text, t.input_types::text[], t.output_types::text[],
         t.built::boolean, t.note::text
    FROM (VALUES
    ('card-action-button', 'Action button', '{"Object set","Single object"}', '{"Flow end"}', false, NULL),
    ('card-after', 'After', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-align-series-to-event-set', 'Align series to event set', '{}', '{}', false, 'the card page declares no Input type or Output type section'),
    ('card-align-to-date', 'Align to date', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-array-contains', 'Array contains', '{"String array","Number array","Time array","Boolean array"}', '{"Boolean"}', false, NULL),
    ('card-array-end', 'Array end', '{"String array","Number array","Time array","Boolean array"}', '{"String","Number","Time","Boolean"}', false, NULL),
    ('card-array-join', 'Array join', '{"String array"}', '{"String"}', false, NULL),
    ('card-array-length', 'Array length', '{"Number array","String array","Time array","Boolean array"}', '{"Number"}', false, NULL),
    ('card-array-sort', 'Array sort', '{"String array","Number array","Time array","Boolean array"}', '{"String array","Number array","Time array","Boolean array"}', false, NULL),
    ('card-array-start', 'Array start', '{"String array","Number array","Time array","Boolean array"}', '{"String","Number","Time","Boolean"}', false, NULL),
    ('card-backing-object-from-time-series', 'Backing object from time series', '{}', '{}', false, 'the card page declares no Input type or Output type section'),
    ('card-bar-chart', 'Bar chart', '{"Object set"}', '{"Categorical chart","Object selection"}', true, NULL),
    ('card-before', 'Before', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-between-inclusive', 'Between (inclusive)', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-bollinger-bands', 'Bollinger bands', '{"Time series"}', '{"Bounded time series"}', false, NULL),
    ('card-boolean-formula', 'Boolean formula', '{"Number","Boolean"}', '{"Boolean"}', false, NULL),
    ('card-boolean-parameter', 'Boolean parameter', '{"Flow start"}', '{"Boolean"}', false, NULL),
    ('card-categorical-formula-plot', 'Categorical formula plot', '{"Categorical chart","Number"}', '{"Categorical chart","Object selection"}', false, NULL),
    ('card-categorical-plot-materialization', 'Categorical plot from materialization', '{"Materialization"}', '{"Categorical chart"}', false, NULL),
    ('card-categorical-scatter-plot', 'Categorical scatter plot', '{"Object set"}', '{"Categorical chart","Object selection"}', false, NULL),
    ('card-ceiling', 'Ceiling', '{"Number"}', '{"Number"}', false, NULL),
    ('card-coalesce', 'Coalesce', '{"Number","String","Time","Boolean","Number array","String array","Time array"}', '{"Number","String","Time","Boolean"}', false, NULL),
    ('card-coalesce-time-series', 'Coalesce time series', '{}', '{"Time series"}', false, 'the page also names Time series array, which the twenty-eight-type enumeration does not carry'),
    ('card-code-function-object-set', 'Code function object set', '{"Object set","Single object","String","Number","Time","Boolean"}', '{"Object set"}', false, NULL),
    ('card-code-function-timeseries', 'Code function time series', '{"Object set","Single object","Number","String","Time","Boolean","Number array","String array","Time array","Boolean array"}', '{"Time series"}', false, NULL),
    ('card-code-function-value', 'Code function value', '{"Object set","Single object","Number","String","Time","Boolean","Number array","String array","Time array","Boolean array"}', '{"Number","String","Time","Boolean","Number array","String array","Time array","Boolean array"}', false, NULL),
    ('card-combine-time-series', 'Combine time series', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-concatenate', 'Concatenate', '{"String"}', '{"String"}', false, NULL),
    ('card-contains', 'Contains', '{"String"}', '{"Boolean"}', false, NULL),
    ('card-correlation-matrix', 'Correlation matrix', '{"Object set"}', '{"Flow end"}', false, NULL),
    ('card-create-array', 'Create array', '{"String","Number","Time","Boolean"}', '{"String array","Number array","Time array","Boolean array"}', false, NULL),
    ('card-create-range', 'Create range', '{"Flow start","Time","Number"}', '{"Numeric range","Time range"}', false, NULL),
    ('card-create-values', 'Create values', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-cross-filter', 'Cross filter', '{"Object set","Categorical chart"}', '{"Object set"}', false, NULL),
    ('card-cross-join-transform-tables', 'Cross join transform tables', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-cumulative-aggregate', 'Cumulative aggregate', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-custom-plot', 'Custom plot (transform table)', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-date-difference', 'Date difference', '{"Time"}', '{"Number"}', false, NULL),
    ('card-date-to-string', 'Date to string', '{"Time"}', '{"String"}', false, NULL),
    ('card-datetime-parameter', 'Date/time parameter', '{"Flow start"}', '{"Time"}', false, NULL),
    ('card-datetime-range-parameter', 'Date/time range parameter', '{"Flow start"}', '{"Time range"}', false, NULL),
    ('card-day-of-month', 'Day of month', '{"Time"}', '{"Number"}', false, NULL),
    ('card-day-of-week', 'Day of week', '{"Time"}', '{"Number"}', false, NULL),
    ('card-day-of-year', 'Day of year', '{"Time"}', '{"Number"}', false, NULL),
    ('card-day-to-date', 'Day to date', '{"Time"}', '{"Time range"}', false, NULL),
    ('card-deduplicate-event-set', 'Deduplicate event set', '{"Event set"}', '{"Event set"}', false, NULL),
    ('card-defined-by-property', 'Defined by property', '{"Object set"}', '{"Object set"}', false, NULL),
    ('card-derivative', 'Derivative', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-derived-property-from-function-on-objects', 'Derived property from function on objects', '{"String","Number","Time","Boolean"}', '{"String"}', false, NULL),
    ('card-does-not-contain', 'Does not contain', '{"String"}', '{"Boolean"}', false, NULL),
    ('card-dsp-filter', 'Digital Signal Processing (DSP) filter', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-duration-unit-parameter', 'Duration unit parameter', '{"Flow start"}', '{"Duration unit"}', false, NULL),
    ('card-edit-values', 'Edit values', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-ends-with', 'Ends with', '{"String"}', '{"Boolean"}', false, NULL),
    ('card-enum-value-at-time', 'Enum value at time', '{"Time series"}', '{"String"}', false, NULL),
    ('card-equal-to', 'Equal to', '{"Number"}', '{"Boolean"}', false, NULL),
    ('card-event-comparison-plot', 'Event comparison plot', '{"Time series","Event set"}', '{"Time series group"}', false, NULL),
    ('card-event-indicator-series', 'Event indicator series', '{"Event set"}', '{"Time series"}', false, NULL),
    ('card-event-set-from-ranges', 'Event set from ranges', '{"Time range"}', '{"Event set"}', false, NULL),
    ('card-event-set-from-tabular-data', 'Event set from tabular data', '{"Transform table","Object set","Materialization"}', '{"Event set"}', false, NULL),
    ('card-event-statistics', 'Event statistics', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-expression', 'Expression', '{"Object set","Materialization"}', '{"Materialization"}', false, NULL),
    ('card-extract-time-series-bound', 'Extract time series bound', '{"Bounded time series"}', '{"Time series"}', false, NULL),
    ('card-filter-materialization', 'Filter materialization', '{"Materialization"}', '{"Materialization"}', false, NULL),
    ('card-filter-object-set', 'Filter object set', '{"Object set"}', '{"Object set"}', true, NULL),
    ('card-filter-time-series', 'Filter time series', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-filter-transform-table', 'Filter transform table', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-find-and-replace', 'Find and replace', '{"String"}', '{"String"}', false, NULL),
    ('card-floor', 'Floor', '{"Number"}', '{"Number"}', false, NULL),
    ('card-foundry-dataset-beta', 'Foundry dataset (Beta)', '{"Flow start"}', '{"Materialization"}', false, NULL),
    ('card-function-on-objects-plot', 'Code function categorical plot', '{"Object set","Single object"}', '{"Categorical chart"}', false, NULL),
    ('card-greater-than', 'Greater than', '{"Number"}', '{"Boolean"}', false, NULL),
    ('card-greater-than-or-equal-to', 'Greater than or equal to', '{"Number"}', '{"Boolean"}', false, NULL),
    ('card-group-by', 'Group by', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-grouped-time-series-plot', 'Grouped time series plot', '{}', '{}', false, 'the card page declares no Input type or Output type section'),
    ('card-heat-grid', 'Heat grid', '{"Object set"}', '{"Object selection"}', false, NULL),
    ('card-hour-of-day', 'Hour of day', '{"Time"}', '{"Number"}', false, NULL),
    ('card-import-saved-object-set', 'Import saved object set', '{"Flow start"}', '{"Object set"}', true, NULL),
    ('card-integral', 'Integral', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-is', 'Is', '{"String","Boolean"}', '{"Boolean"}', false, NULL),
    ('card-is-not', 'Is not', '{"String","Boolean"}', '{"Boolean"}', false, NULL),
    ('card-join-materializations', 'Join materializations', '{"Object set","Materialization"}', '{"Materialization"}', false, NULL),
    ('card-join-to-linked-objects', 'Join to linked objects', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-join-to-transform-table', 'Join to transform table', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-joined-group-by', 'Joined group by', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-latest-value-for-enum-time-series', 'Latest value for enum time series', '{}', '{"String"}', false, 'the page also names Enum time series, which the twenty-eight-type enumeration does not carry'),
    ('card-less-than', 'Less than', '{"Number"}', '{"Boolean"}', false, NULL),
    ('card-less-than-or-equal-to', 'Less than or equal to', '{"Number"}', '{"Boolean"}', false, NULL),
    ('card-line-chart', 'Line chart', '{"Object set"}', '{"Categorical chart","Object selection"}', false, NULL),
    ('card-linear-aggregation', 'Linear aggregation', '{"Time series","Time series group","Transform table"}', '{"Time series"}', false, NULL),
    ('card-linked-event-set', 'Linked event set', '{"Single object","Time series"}', '{"Event set"}', false, NULL),
    ('card-linked-series-aggregation', 'Linked series aggregation', '{"Single object"}', '{"Time series"}', false, NULL),
    ('card-list', 'List', '{"Object set"}', '{"Object selection"}', false, NULL),
    ('card-manual-entry-transform-table', 'Manual entry transform table', '{"Flow start"}', '{"Transform table"}', false, NULL),
    ('card-map', 'Map', '{"Object set"}', '{"Object selection"}', false, NULL),
    ('card-materialization-sql', 'Materialization SQL', '{"Materialization","Time","Number","String","Boolean"}', '{"Materialization"}', false, NULL),
    ('card-media-property', 'Media property', '{"Single object"}', '{"Flow end"}', false, NULL),
    ('card-month', 'Month', '{"Time"}', '{"Number"}', false, NULL),
    ('card-month-to-date', 'Month to date', '{"Time"}', '{"Time range"}', false, NULL),
    ('card-multi-chart-time-series', 'Multi chart time series', '{"Object set"}', '{"Flow end"}', false, NULL),
    ('card-multipass-attribute', 'Multipass attribute', '{"Flow start","String"}', '{"String"}', false, NULL),
    ('card-not-equal-to', 'Not equal to', '{"Number"}', '{"Boolean"}', false, NULL),
    ('card-not-on', 'Not on', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-number-array-aggregation', 'Number array aggregation', '{"Number array"}', '{"Number"}', false, NULL),
    ('card-number-to-date', 'Number to date', '{"Number"}', '{"Time"}', false, NULL),
    ('card-numeric-aggregation', 'Numeric aggregation', '{"Object set"}', '{"Number"}', true, NULL),
    ('card-numeric-aggregation-materialization', 'Numeric aggregation (materialization)', '{"Materialization"}', '{"Number","Time"}', false, NULL),
    ('card-numeric-formula', 'Numeric formula', '{"Number"}', '{"Number"}', true, NULL),
    ('card-numeric-parameter', 'Numeric parameter', '{"Flow start"}', '{"Number"}', true, NULL),
    ('card-numeric-range-parameter', 'Numeric range parameter', '{"Flow start"}', '{"Numeric range"}', false, NULL),
    ('card-numeric-range-to-date-range', 'Numeric range to date range', '{"Numeric range"}', '{"Time range"}', false, NULL),
    ('card-numeric-series-formula', 'Numeric series formula', '{"Number","Single object"}', '{"Time series"}', false, NULL),
    ('card-numerical-scatter-plot', 'Numerical scatter plot', '{"Object set"}', '{"Object selection"}', false, NULL),
    ('card-object-property', 'Object property', '{"Single object"}', '{"String","Number","Time"}', true, NULL),
    ('card-object-selector', 'Object selector', '{"Flow start","Object set"}', '{"Single object"}', true, NULL),
    ('card-object-set-materialization', 'Object set materialization', '{"Object set"}', '{"Materialization"}', false, NULL),
    ('card-object-view', 'Object view', '{"Flow start","Single object"}', '{"Single object"}', false, NULL),
    ('card-on', 'On', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-on-or-after', 'On or after', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-on-or-before', 'On or before', '{"Time"}', '{"Boolean"}', false, NULL),
    ('card-ontology-sql', 'Ontology SQL', '{"Object set","Ontology SQL","Time","Number","String","Boolean"}', '{"Ontology SQL"}', false, NULL),
    ('card-overlay-chart', 'Overlay chart', '{"Categorical chart"}', '{"Object selection"}', false, NULL),
    ('card-periodic-aggregate', 'Periodic aggregate', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-pie-chart', 'Pie chart', '{"Object set"}', '{"Categorical chart","Object selection"}', false, NULL),
    ('card-pivot-table', 'Pivot table', '{"Object set"}', '{"Pivot table","Object selection"}', false, NULL),
    ('card-pivot-transform-table', 'Pivot transform table', '{"Transform table"}', '{"Pivot table","Transform table"}', false, NULL),
    ('card-property-value-select-parameter', 'Property value select parameter', '{"Object set"}', '{"String","String array"}', false, NULL),
    ('card-range-end', 'Range end', '{"Numeric range","Time range"}', '{"Number","Time"}', false, NULL),
    ('card-range-start', 'Range start', '{"Numeric range","Time range"}', '{"Number","Time"}', false, NULL),
    ('card-reference-profile-bounds', 'Reference profile bounds', '{"Time series group"}', '{"Bounded time series"}', false, NULL),
    ('card-relative-time-series', 'Relative time', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-rename-columns', 'Rename columns', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-rolling-aggregate', 'Rolling aggregate', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-row-number', 'Row number', '{"Flow start"}', '{"Number"}', false, NULL),
    ('card-sample', 'Sample', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-scatter-plot-regression', 'Scatter plot regression', '{"Time scatter plot"}', '{"Time series"}', false, NULL),
    ('card-scatter-plot-regression-coefficients', 'Scatter plot regression coefficients', '{}', '{"Number array"}', false, 'the page also names Time series scatter plot regression, which the twenty-eight-type enumeration does not carry'),
    ('card-segment-formula-plot', 'Segment formula plot', '{"Categorical chart","Number"}', '{"Categorical chart","Object selection"}', false, NULL),
    ('card-segment-statistics', 'Segment statistics', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-select-columns', 'Select columns', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-set-math', 'Set math', '{"Object set"}', '{"Object set"}', true, NULL),
    ('card-set-math-materialization', 'Set math (materialization)', '{"Materialization"}', '{"Materialization"}', false, NULL),
    ('card-shift-datetime', 'Shift date/time', '{"Time"}', '{"Time"}', false, NULL),
    ('card-shift-time-series', 'Shift time series', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-split', 'Split', '{"String"}', '{"String array"}', false, NULL),
    ('card-starts-with', 'Starts with', '{"String"}', '{"Boolean"}', false, NULL),
    ('card-static-time', 'Static time', '{"Flow start","Time"}', '{"Time"}', false, NULL),
    ('card-status-filter', 'Status filter', '{"Object set","Time range"}', '{"Object set"}', false, NULL),
    ('card-stepped-array', 'Stepped array', '{"Number"}', '{"Number array"}', false, NULL),
    ('card-string-array-parameter', 'String array parameter', '{"Flow start"}', '{"String array"}', false, NULL),
    ('card-string-parameter', 'String parameter', '{"Flow start"}', '{"String"}', true, NULL),
    ('card-string-selector', 'String selector', '{"String array"}', '{"String","String array"}', false, NULL),
    ('card-string-to-boolean', 'String to Boolean', '{"String"}', '{"Boolean"}', false, NULL),
    ('card-string-to-date', 'String to date', '{"String"}', '{"Time"}', false, NULL),
    ('card-string-to-number', 'String to number', '{"String"}', '{"Number"}', false, NULL),
    ('card-strings-to-booleans', 'Strings to booleans', '{"String array"}', '{"Boolean array"}', false, NULL),
    ('card-strings-to-dates', 'Strings to dates', '{"String array"}', '{"Time array"}', false, NULL),
    ('card-strings-to-numbers', 'Strings to numbers', '{"String array"}', '{"Number array"}', false, NULL),
    ('card-substring', 'Substring', '{"String"}', '{"String"}', false, NULL),
    ('card-switch-to-linked-object-set', 'Switch to linked object set', '{"Object set"}', '{"Object set"}', true, NULL),
    ('card-table', 'Table', '{"Object set"}', '{"Object selection"}', true, NULL),
    ('card-tabular-time-series', 'Tabular time series', '{"Object set","Transform table"}', '{"Time series"}', false, NULL),
    ('card-time-series-bounds', 'Time series bounds', '{"Time series"}', '{"Bounded time series"}', false, NULL),
    ('card-time-series-distribution', 'Time series distribution', '{"Time series"}', '{"Flow end"}', false, NULL),
    ('card-time-series-end-date', 'Time series end date', '{"Time series"}', '{"Time"}', false, NULL),
    ('card-time-series-forecast', 'Forecast time series', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-time-series-formula', 'Time series formula', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-time-series-heat-grid', 'Time series heat grid', '{"Time series"}', '{"Flow end"}', false, NULL),
    ('card-time-series-numeric-aggregation', 'Time series numeric aggregation', '{"Time series"}', '{"Number"}', false, NULL),
    ('card-time-series-property', 'Time series property', '{"Single object"}', '{"Time series"}', false, NULL),
    ('card-time-series-regression', 'Time series regression', '{"Time series"}', '{"Time series"}', false, NULL),
    ('card-time-series-regression-coefficients', 'Time series regression coefficients', '{"Time series"}', '{"Number array"}', false, NULL),
    ('card-time-series-scatter-plot', 'Time series scatter plot', '{"Time series"}', '{"Time scatter plot"}', false, NULL),
    ('card-time-series-search', 'Time series search', '{"Time series","Bounded time series","Transform table"}', '{"Event set"}', false, NULL),
    ('card-time-series-start-date', 'Time series start date', '{"Time series"}', '{"Time"}', false, NULL),
    ('card-time-series-sync', 'Time series sync', '{"Flow start"}', '{"Time series"}', false, NULL),
    ('card-time-series-unit', 'Time series unit', '{"Time series"}', '{"String"}', false, NULL),
    ('card-time-shift-event-set', 'Time shift event set', '{"Event set"}', '{"Event set"}', false, NULL),
    ('card-to-lower-case', 'To lower case', '{"String"}', '{"String"}', false, NULL),
    ('card-to-upper-case', 'To upper case', '{"String"}', '{"String"}', false, NULL),
    ('card-transform-table', 'Transform table', '{"Object set","Transform table","Event set","Materialization","Categorical chart","Pivot table","Time series chart","Ontology SQL","Number array","String array","Boolean array","Time array"}', '{"Transform table"}', false, 'the page also names Materialization SQL, which the twenty-eight-type enumeration does not carry'),
    ('card-transform-table-aggregation', 'Transform table aggregation', '{"Transform table"}', '{"Number"}', false, NULL),
    ('card-transform-table-column-values', 'Transform table column values', '{"Transform table"}', '{"Number array","String array","Time array","Boolean array"}', false, NULL),
    ('card-transform-table-plot', 'Categorical plot from transform table', '{"Transform table"}', '{"Categorical chart"}', false, NULL),
    ('card-transform-table-row-selector', 'Transform table row selector', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-union-transform-table', 'Union (transform table)', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-unique-column-values-materialization', 'Unique column values (materialization)', '{"Materialization"}', '{"Number array","String array","Boolean array","Time array"}', false, NULL),
    ('card-unique-property-values', 'Unique property values', '{"Object set"}', '{"String","String array"}', false, NULL),
    ('card-unique-values', 'Unique values', '{"String array","Number array","Time array","Boolean array"}', '{"String array","Number array","Time array","Boolean array"}', false, NULL),
    ('card-value-at-index', 'Value at index', '{"String array","Number array","Time array","Boolean array"}', '{"String","Number","Time","Boolean"}', false, NULL),
    ('card-value-at-time', 'Value at time', '{"Time series"}', '{"Number"}', false, NULL),
    ('card-vega-plot', 'Vega plot', '{"Transform table"}', '{"Transform table"}', false, NULL),
    ('card-visual-function-boolean', 'Visual function boolean', '{"Object set","Single object","Number","String","Time","Boolean"}', '{"Boolean"}', false, NULL),
    ('card-visual-function-datetime', 'Visual function date/time', '{"Object set","Single object","Number","String","Time","Boolean"}', '{"Time"}', false, NULL),
    ('card-visual-function-metric', 'Visual function metric', '{"Object set","Single object","Number","String","Time","Boolean"}', '{"Number"}', false, NULL),
    ('card-visual-function-property-select', 'Visual function property select', '{"Object set","Single object","Number","String","Time","Boolean"}', '{"String array"}', false, NULL),
    ('card-visual-function-string', 'Visual function string', '{"Object set","Single object","Number","String","Time","Boolean"}', '{"String"}', false, NULL),
    ('card-visual-function-time-range', 'Visual function time range', '{"Object set","Single object","Number","String","Time","Boolean"}', '{"Time range"}', false, NULL),
    ('card-waterfall-plot', 'Waterfall plot', '{"Object set","Number"}', '{"Flow end"}', false, NULL),
    ('card-week-to-date', 'Week to date', '{"Time"}', '{"Time range"}', false, NULL),
    ('card-xy-range-parameter', 'X/Y range parameter', '{"Flow start"}', '{"X/Y range"}', false, NULL),
    ('card-year', 'Year', '{"Time"}', '{"Number"}', false, NULL),
    ('card-year-to-date', 'Year to date', '{"Time"}', '{"Time range"}', false, NULL)
  ) AS t(kind, title, input_types, output_types, built, note)
$$;
COMMENT ON FUNCTION public.quiver_card_kinds() IS
  'Every card Quiver documents (203), with the signature its own page declares, normalised to the twenty-eight-type enumeration. An index, not an allowlist: a kind here with built = false refuses by name rather than rendering blank, which is what "Understanding a card''s output type, and which downstream cards it can be used in is a very important concept in Quiver" (quiver/analysis-data-model) needs in order to mean anything. note carries what the page said that the enumeration does not carry.';

-- ── the analysis ────────────────────────────────────────────────────────────

CREATE TABLE public.quiver_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('quiver', 'analysis', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  analysis_type   text NOT NULL DEFAULT 'quiver'
                    CONSTRAINT quiver_analysis_type_check
                    CHECK (analysis_type = ANY (ARRAY['quiver', 'time_series', 'object_set_path'])),
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX quiver_analyses_rid_key ON public.quiver_analyses (rid);
CREATE INDEX quiver_analyses_project_idx ON public.quiver_analyses (project_id);
CREATE INDEX quiver_analyses_folder_idx ON public.quiver_analyses (folder_id);
CREATE INDEX quiver_analyses_org_idx ON public.quiver_analyses (organization_id);
CREATE INDEX quiver_analyses_created_by_idx ON public.quiver_analyses (created_by);
COMMENT ON TABLE public.quiver_analyses IS
  'A Quiver analysis: a typed graph of cards over the ontology. A project resource, whose permissions ARE the project''s (quiver/analysis-save-share).';
COMMENT ON CONSTRAINT quiver_analysis_type_check ON public.quiver_analyses IS
  'Values from quiver/analysis-types, whose comparison table has exactly three columns: "Quiver analysis | Time series analysis | Object set path analysis". The simpler two convert up and never back.';

-- ── canvases ────────────────────────────────────────────────────────────────

CREATE TABLE public.quiver_canvases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.quiver_analyses(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX quiver_canvases_analysis_idx ON public.quiver_canvases (analysis_id);
COMMENT ON TABLE public.quiver_canvases IS
  'A page of the analysis: "A canvas is a page where you can display, rearrange, and resize the cards in your analysis. An analysis can contain multiple canvases" (quiver/analysis-canvas). Display only — it carries no dependency information.';

-- ── cards ───────────────────────────────────────────────────────────────────

CREATE TABLE public.quiver_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.quiver_analyses(id) ON DELETE CASCADE,
  -- "$A", stamped on insert; unique within the analysis, never dense
  global_id   text NOT NULL CHECK (global_id ~ '^\$[A-Z]+$'),
  kind        text NOT NULL,
  title       text NOT NULL DEFAULT '' ,
  -- which of the kind's output types this card actually emits, when the kind
  -- declares more than one (an object property emits String, Number or Time
  -- depending on the property picked)
  output_type text,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(config) = 'object')
);
CREATE UNIQUE INDEX quiver_cards_global_id_key ON public.quiver_cards (analysis_id, global_id);
CREATE INDEX quiver_cards_analysis_idx ON public.quiver_cards (analysis_id);
COMMENT ON TABLE public.quiver_cards IS
  'One card. Its kind names a row of quiver_card_kinds(), which is where its signature lives — the card itself stores only what the author configured.';
COMMENT ON COLUMN public.quiver_cards.global_id IS
  '"Unique Quiver global identifiers (IDs) in the form of `$A` are automatically assigned to all Quiver cards when added to an analysis" (quiver/analysis-global-identifiers). Past $Z they continue $AA, $AB — concepts-global-ids.png shows $AHK. Stamped by trigger, in 679''s pattern.';
COMMENT ON COLUMN public.quiver_cards.output_type IS
  'The one type this card emits. Required when its kind declares several, because the type check compares one type to one type: "A card can only be added as an input to another card if that card''s output type is equal to the downstream card''s input type" (quiver/analysis-data-model).';

-- 1 -> $A, 26 -> $Z, 27 -> $AA
CREATE FUNCTION public.quiver_global_id(n integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text := ''; k integer := n;
BEGIN
  IF n < 1 THEN RAISE EXCEPTION 'Quiver:BadOrdinal — % is not a card ordinal', n; END IF;
  WHILE k > 0 LOOP
    k := k - 1;
    s := chr(65 + (k % 26)) || s;
    k := k / 26;
  END LOOP;
  RETURN '$' || s;
END $$;

CREATE FUNCTION public.stamp_quiver_global_id()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  IF NEW.global_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT count(*) + 1 INTO n FROM public.quiver_cards WHERE analysis_id = NEW.analysis_id;
  -- a deleted card leaves its letter behind; the IDs are unique, not dense
  WHILE EXISTS (SELECT 1 FROM public.quiver_cards c
                 WHERE c.analysis_id = NEW.analysis_id
                   AND c.global_id = public.quiver_global_id(n)) LOOP
    n := n + 1;
  END LOOP;
  NEW.global_id := public.quiver_global_id(n);
  RETURN NEW;
END $$;
CREATE TRIGGER stamp_quiver_global_id
  BEFORE INSERT ON public.quiver_cards
  FOR EACH ROW EXECUTE FUNCTION public.stamp_quiver_global_id();

-- the card's one output type, resolved
CREATE FUNCTION public.quiver_card_output_type(p_card uuid)
RETURNS text LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(c.output_type,
                  CASE WHEN array_length(k.output_types, 1) = 1
                       THEN k.output_types[1] END)
    FROM public.quiver_cards c
    JOIN public.quiver_card_kinds() k ON k.kind = c.kind
   WHERE c.id = p_card
$$;

CREATE FUNCTION public.guard_quiver_card_kind()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k record;
BEGIN
  SELECT * INTO k FROM public.quiver_card_kinds() ck WHERE ck.kind = NEW.kind;
  IF k.kind IS NULL THEN
    RAISE EXCEPTION 'Quiver:UnknownCardKind — % is not a card Quiver documents', NEW.kind;
  END IF;
  IF NOT k.built THEN
    RAISE EXCEPTION 'Quiver:CardNotBuilt — % (%) is a Quiver card this platform has not built', k.title, NEW.kind;
  END IF;
  IF NEW.output_type IS NULL AND array_length(k.output_types, 1) > 1 THEN
    RAISE EXCEPTION 'Quiver:OutputTypeAmbiguous — % emits one of %, so the card must say which', k.title, array_to_string(k.output_types, ', ');
  END IF;
  IF NEW.output_type IS NOT NULL AND NOT (NEW.output_type = ANY (k.output_types)) THEN
    RAISE EXCEPTION 'Quiver:OutputTypeNotDeclared — % does not emit %, it emits %', k.title, NEW.output_type, array_to_string(k.output_types, ', ');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_quiver_card_kind
  BEFORE INSERT OR UPDATE OF kind, output_type ON public.quiver_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_quiver_card_kind();

-- ── the typed edges ─────────────────────────────────────────────────────────

CREATE TABLE public.quiver_card_inputs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid NOT NULL REFERENCES public.quiver_cards(id) ON DELETE CASCADE,
  -- a card may take several inputs; the slot is which one
  slot          integer NOT NULL DEFAULT 0 CHECK (slot >= 0),
  input_card_id uuid NOT NULL REFERENCES public.quiver_cards(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX quiver_card_inputs_slot_key ON public.quiver_card_inputs (card_id, slot);
CREATE INDEX quiver_card_inputs_card_idx ON public.quiver_card_inputs (card_id);
CREATE INDEX quiver_card_inputs_input_idx ON public.quiver_card_inputs (input_card_id);
COMMENT ON TABLE public.quiver_card_inputs IS
  'One edge of the analysis graph, type-checked on write against quiver_card_kinds(). "Every card in Quiver can take zero or more inputs and produces an output of a specific type" (quiver/analysis-data-model) — this is the zero or more.';

CREATE FUNCTION public.guard_quiver_card_input()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  down record; down_kind text; up_kind text; up_type text;
  up_analysis uuid; down_analysis uuid;
BEGIN
  IF NEW.card_id = NEW.input_card_id THEN
    RAISE EXCEPTION 'Quiver:SelfInput — a card cannot be its own input';
  END IF;

  SELECT c.analysis_id, c.kind INTO down_analysis, down_kind
    FROM public.quiver_cards c WHERE c.id = NEW.card_id;
  SELECT c.analysis_id, c.kind INTO up_analysis, up_kind
    FROM public.quiver_cards c WHERE c.id = NEW.input_card_id;
  IF down_analysis IS DISTINCT FROM up_analysis THEN
    RAISE EXCEPTION 'Quiver:CrossAnalysisInput — a card may only take inputs from its own analysis';
  END IF;

  SELECT * INTO down FROM public.quiver_card_kinds() k WHERE k.kind = down_kind;
  IF coalesce(array_length(down.input_types, 1), 0) = 0
     OR down.input_types = ARRAY['Flow start'] THEN
    RAISE EXCEPTION 'Quiver:TakesNoInputs — % takes no inputs', down.title;
  END IF;

  up_type := public.quiver_card_output_type(NEW.input_card_id);
  IF up_type IS NULL THEN
    RAISE EXCEPTION 'Quiver:NoOutputType — the input card emits no type this platform knows';
  END IF;
  IF NOT (up_type = ANY (down.input_types)) THEN
    RAISE EXCEPTION 'Quiver:TypeMismatch — % emits %, but % accepts %', up_kind, up_type,
      down.title, array_to_string(down.input_types, ', ');
  END IF;

  -- the graph is acyclic: reaching NEW.card_id from NEW.input_card_id upward
  -- would close a loop
  IF EXISTS (
    WITH RECURSIVE up_from(id) AS (
      SELECT NEW.input_card_id
      UNION
      SELECT i.input_card_id FROM public.quiver_card_inputs i
        JOIN up_from u ON u.id = i.card_id)
    SELECT 1 FROM up_from WHERE id = NEW.card_id) THEN
    RAISE EXCEPTION 'Quiver:Cycle — that input would make the analysis graph circular';
  END IF;

  RETURN NEW;
END $$;
CREATE TRIGGER guard_quiver_card_input
  BEFORE INSERT OR UPDATE ON public.quiver_card_inputs
  FOR EACH ROW EXECUTE FUNCTION public.guard_quiver_card_input();

-- ── canvas membership, which is geometry and not ordering ───────────────────

CREATE TABLE public.quiver_canvas_cards (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES public.quiver_canvases(id) ON DELETE CASCADE,
  card_id   uuid NOT NULL REFERENCES public.quiver_cards(id) ON DELETE CASCADE,
  x         integer NOT NULL DEFAULT 0,
  y         integer NOT NULL DEFAULT 0,
  width     integer NOT NULL DEFAULT 6 CHECK (width > 0),
  height    integer NOT NULL DEFAULT 4 CHECK (height > 0),
  hidden    boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX quiver_canvas_cards_key ON public.quiver_canvas_cards (canvas_id, card_id);
CREATE INDEX quiver_canvas_cards_card_idx ON public.quiver_canvas_cards (card_id);
COMMENT ON TABLE public.quiver_canvas_cards IS
  'Where a card sits on a canvas, and whether it is shown. A card with NO row here is the page''s "Not in canvas" state, which is legal. This table carries no dependency information: "Rearranging cards in your canvas will not affect the underlying sequence of data transformation" (quiver/analysis-canvas).';

-- ── dashboards ──────────────────────────────────────────────────────────────

CREATE TABLE public.quiver_dashboards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.quiver_analyses(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  view_style  text NOT NULL DEFAULT 'default'
                CONSTRAINT quiver_dashboard_view_style_check
                CHECK (view_style = ANY (ARRAY['default', 'compact', 'stretch'])),
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX quiver_dashboards_analysis_idx ON public.quiver_dashboards (analysis_id);
COMMENT ON TABLE public.quiver_dashboards IS
  'A read-only presentation of an analysis: "Quiver dashboard mode allows you to present insights from your analysis in read-only, interactive dashboards" (quiver/dashboards-overview). Many per analysis, by that page''s first bullet.';
COMMENT ON CONSTRAINT quiver_dashboard_view_style_check ON public.quiver_dashboards IS
  'Values from quiver/dashboards-create: "You will have the option to choose between three view styles: default, compact, and stretch."';

CREATE TABLE public.quiver_dashboard_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.quiver_dashboards(id) ON DELETE CASCADE,
  card_id      uuid NOT NULL REFERENCES public.quiver_cards(id) ON DELETE CASCADE,
  x            integer NOT NULL DEFAULT 0,
  y            integer NOT NULL DEFAULT 0,
  width        integer NOT NULL DEFAULT 6 CHECK (width > 0),
  height       integer NOT NULL DEFAULT 4 CHECK (height > 0)
);
CREATE UNIQUE INDEX quiver_dashboard_cards_key ON public.quiver_dashboard_cards (dashboard_id, card_id);
CREATE INDEX quiver_dashboard_cards_card_idx ON public.quiver_dashboard_cards (card_id);
COMMENT ON COLUMN public.quiver_dashboard_cards.height IS
  'Height matters to the stretch style in particular: "This is required when the dashboard''s view style is set to stretch, otherwise the widget will have a default height of 0 pixels" (quiver/dashboards-object-view).';

-- ── saving, which is manual and versioned ───────────────────────────────────

CREATE TABLE public.quiver_analysis_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.quiver_analyses(id) ON DELETE CASCADE,
  snapshot    jsonb NOT NULL,
  saved_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  saved_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(snapshot) = 'object')
);
CREATE INDEX quiver_versions_analysis_idx ON public.quiver_analysis_versions (analysis_id, saved_at DESC);
CREATE INDEX quiver_versions_saved_by_idx ON public.quiver_analysis_versions (saved_by);
COMMENT ON TABLE public.quiver_analysis_versions IS
  'One saved version, so that "Access and revert to historical versions of your analysis by opening the Analysis history menu" (quiver/analysis-save-share) has something to list. Saving is MANUAL in Quiver — the page''s auto-save is of a working state, not a version. INFERENCE: the page does not say what a version stores; a whole-analysis snapshot is ours.';

-- ── the three-part unused test, and deletion with a mode ────────────────────

CREATE FUNCTION public.unused_quiver_cards(p_analysis uuid)
RETURNS TABLE (card_id uuid, global_id text, kind text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  -- the page's three criteria, in its order
  WITH RECURSIVE on_canvas AS (
    SELECT cc.card_id AS id FROM public.quiver_canvas_cards cc
      JOIN public.quiver_canvases cv ON cv.id = cc.canvas_id
     WHERE cv.analysis_id = p_analysis
  ), depended AS (
    SELECT id FROM on_canvas
    UNION
    SELECT i.input_card_id FROM public.quiver_card_inputs i
      JOIN depended d ON d.id = i.card_id
  )
  SELECT c.id, c.global_id, c.kind
    FROM public.quiver_cards c
   WHERE c.analysis_id = p_analysis
     -- "It is not placed on any canvas"
     AND NOT EXISTS (SELECT 1 FROM on_canvas o WHERE o.id = c.id)
     -- "No card on a canvas depends on it"
     AND NOT EXISTS (SELECT 1 FROM depended d WHERE d.id = c.id)
     -- "It is not referenced by any dashboard, function, or global settings
     -- entity" — of those three we have dashboards; the other two do not
     -- exist in Quiver here, and neither is silently treated as satisfied
     AND NOT EXISTS (SELECT 1 FROM public.quiver_dashboard_cards dc
                      WHERE dc.card_id = c.id)
$$;
COMMENT ON FUNCTION public.unused_quiver_cards(uuid) IS
  'The page''s definition, not ours: a card is unused only if "It is not placed on any canvas", "No card on a canvas depends on it" and "It is not referenced by any dashboard, function, or global settings entity" (quiver/analysis-canvas). The second is transitive here, since a card feeding a card that feeds a canvas card is depended on. Quiver functions and global settings entities are not built, so the third reduces to dashboards.';

CREATE FUNCTION public.delete_quiver_card(p_card uuid, p_mode text DEFAULT 'delete')
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer := 0;
BEGIN
  IF NOT (p_mode = ANY (ARRAY['delete', 'remove_from_canvas'])) THEN
    RAISE EXCEPTION 'Quiver:UnknownDeleteMode — % is neither delete nor remove_from_canvas', p_mode;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiver_cards WHERE id = p_card) THEN
    RAISE EXCEPTION 'Quiver:CardNotFound — % is not a card you can see', p_card;
  END IF;

  IF p_mode = 'remove_from_canvas' THEN
    -- "Keeps the card in the analysis and keeps dependent cards unchanged."
    DELETE FROM public.quiver_canvas_cards WHERE card_id = p_card;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
  END IF;

  -- "Removes the card from the analysis entirely. Any cards that use it as an
  -- input will have that input configuration set to empty" — the edge goes,
  -- the downstream card stays and its slot is now empty.
  DELETE FROM public.quiver_card_inputs WHERE input_card_id = p_card;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.quiver_cards WHERE id = p_card;
  RETURN n;
END $$;
COMMENT ON FUNCTION public.delete_quiver_card(uuid, text) IS
  'Deletion takes a MODE because the page gives two: "Delete and remove from downstream cards" and "Remove from canvas". Returns how many downstream slots were emptied, or how many canvases the card left. INVOKER — the card''s own policy decides who may.';

-- ── creation and saving ─────────────────────────────────────────────────────

CREATE FUNCTION public.create_quiver_analysis(p_project uuid, p_name text,
                                              p_type text DEFAULT 'quiver')
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE a uuid;
BEGIN
  INSERT INTO public.quiver_analyses (project_id, name, analysis_type)
  VALUES (p_project, p_name, p_type) RETURNING id INTO a;
  -- the capture's canvas tab bar opens with one tab, named Canvas
  INSERT INTO public.quiver_canvases (analysis_id, name, position)
  VALUES (a, 'Canvas', 0);
  RETURN a;
END $$;
COMMENT ON FUNCTION public.create_quiver_analysis(uuid, text, text) IS
  'Creates an analysis with its first canvas, named Canvas after howto-analysis-canvas-annotated.png''s tab bar. INVOKER, so the analysis'' own policy decides who may.';

CREATE FUNCTION public.save_quiver_analysis(p_analysis uuid)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v uuid; snap jsonb;
BEGIN
  SELECT jsonb_build_object(
    'cards', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.global_id)
                         FROM public.quiver_cards c WHERE c.analysis_id = p_analysis), '[]'::jsonb),
    'inputs', coalesce((SELECT jsonb_agg(to_jsonb(i))
                          FROM public.quiver_card_inputs i
                          JOIN public.quiver_cards c ON c.id = i.card_id
                         WHERE c.analysis_id = p_analysis), '[]'::jsonb),
    'canvases', coalesce((SELECT jsonb_agg(to_jsonb(cv) ORDER BY cv.position)
                            FROM public.quiver_canvases cv WHERE cv.analysis_id = p_analysis), '[]'::jsonb),
    'placements', coalesce((SELECT jsonb_agg(to_jsonb(cc))
                              FROM public.quiver_canvas_cards cc
                              JOIN public.quiver_canvases cv ON cv.id = cc.canvas_id
                             WHERE cv.analysis_id = p_analysis), '[]'::jsonb))
  INTO snap;
  IF snap IS NULL THEN
    RAISE EXCEPTION 'Quiver:AnalysisNotFound — % is not an analysis you can see', p_analysis;
  END IF;
  INSERT INTO public.quiver_analysis_versions (analysis_id, snapshot)
  VALUES (p_analysis, snap) RETURNING id INTO v;
  RETURN v;
END $$;
COMMENT ON FUNCTION public.save_quiver_analysis(uuid) IS
  'The Save button: "Quiver analyses are saved manually by clicking the Save button" (quiver/core-concepts). Snapshots the graph, the canvases and the placements. INVOKER, so a viewer''s SELECT-only policy stops the insert.';

-- ── RLS: the project decides, composed rather than restated ─────────────────

ALTER TABLE public.quiver_analyses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_canvases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_card_inputs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_canvas_cards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_dashboards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_dashboard_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiver_analysis_versions ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_quiver_analysis(p_analysis uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.quiver_analyses a
                  WHERE a.id = p_analysis
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(a.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_quiver_analysis(p_analysis uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.quiver_analyses a
                  WHERE a.id = p_analysis
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(a.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_quiver_analysis(uuid) IS
  '"users with view access can see (not edit) a Quiver analysis, while users with edit access can view and update it" (quiver/analysis-save-share). The project''s role, asked once.';

CREATE POLICY "project members read analyses" ON public.quiver_analyses
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author analyses" ON public.quiver_analyses
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read canvases" ON public.quiver_canvases
  FOR SELECT USING ((SELECT public.can_read_quiver_analysis(analysis_id)));
CREATE POLICY "author canvases" ON public.quiver_canvases
  FOR ALL USING ((SELECT public.can_edit_quiver_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_quiver_analysis(analysis_id)));

CREATE POLICY "read cards" ON public.quiver_cards
  FOR SELECT USING ((SELECT public.can_read_quiver_analysis(analysis_id)));
CREATE POLICY "author cards" ON public.quiver_cards
  FOR ALL USING ((SELECT public.can_edit_quiver_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_quiver_analysis(analysis_id)));

CREATE POLICY "read dashboards" ON public.quiver_dashboards
  FOR SELECT USING ((SELECT public.can_read_quiver_analysis(analysis_id)));
CREATE POLICY "author dashboards" ON public.quiver_dashboards
  FOR ALL USING ((SELECT public.can_edit_quiver_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_quiver_analysis(analysis_id)));

CREATE POLICY "read versions" ON public.quiver_analysis_versions
  FOR SELECT USING ((SELECT public.can_read_quiver_analysis(analysis_id)));
CREATE POLICY "author versions" ON public.quiver_analysis_versions
  FOR ALL USING ((SELECT public.can_edit_quiver_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_quiver_analysis(analysis_id)));

CREATE POLICY "read card inputs" ON public.quiver_card_inputs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.quiver_cards c
                             WHERE c.id = card_id
                               AND public.can_read_quiver_analysis(c.analysis_id)));
CREATE POLICY "author card inputs" ON public.quiver_card_inputs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.quiver_cards c
                          WHERE c.id = card_id
                            AND public.can_edit_quiver_analysis(c.analysis_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiver_cards c
                       WHERE c.id = card_id
                         AND public.can_edit_quiver_analysis(c.analysis_id)));

CREATE POLICY "read canvas cards" ON public.quiver_canvas_cards
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.quiver_canvases cv
                             WHERE cv.id = canvas_id
                               AND public.can_read_quiver_analysis(cv.analysis_id)));
CREATE POLICY "author canvas cards" ON public.quiver_canvas_cards
  FOR ALL USING (EXISTS (SELECT 1 FROM public.quiver_canvases cv
                          WHERE cv.id = canvas_id
                            AND public.can_edit_quiver_analysis(cv.analysis_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiver_canvases cv
                       WHERE cv.id = canvas_id
                         AND public.can_edit_quiver_analysis(cv.analysis_id)));

CREATE POLICY "read dashboard cards" ON public.quiver_dashboard_cards
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.quiver_dashboards d
                             WHERE d.id = dashboard_id
                               AND public.can_read_quiver_analysis(d.analysis_id)));
CREATE POLICY "author dashboard cards" ON public.quiver_dashboard_cards
  FOR ALL USING (EXISTS (SELECT 1 FROM public.quiver_dashboards d
                          WHERE d.id = dashboard_id
                            AND public.can_edit_quiver_analysis(d.analysis_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiver_dashboards d
                       WHERE d.id = dashboard_id
                         AND public.can_edit_quiver_analysis(d.analysis_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_analyses          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_canvases          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_cards             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_card_inputs       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_canvas_cards      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_dashboards        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_dashboard_cards   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiver_analysis_versions TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────
--
-- The acceptance test is the data model page's own worked example, run as
-- `authenticated`: a filter object set may not feed an object property, and
-- an object selector between them makes it legal.

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; a uuid; cv uuid;
  root uuid; filt uuid; sel uuid; prop uuid; agg uuid; bar uuid; l1 uuid; l2 uuid;
  u1 uuid := gen_random_uuid(); before text;
  n integer; v uuid; ids text[];
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('qv-696') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('qv-696') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qv696@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'qv696@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'qv_696', 'Quiver 696') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- 1. The catalogue is complete and normalised.
    SELECT count(*) INTO n FROM public.quiver_card_kinds();
    IF n <> 203 THEN RAISE EXCEPTION 'the catalogue holds % kinds, not the 203 card pages', n; END IF;
    SELECT count(*) INTO n FROM public.quiver_data_types();
    IF n <> 28 THEN RAISE EXCEPTION 'the enumeration holds % types, not 28', n; END IF;
    -- every type either card names IS one of the twenty-eight
    SELECT count(*) INTO n FROM public.quiver_card_kinds() k,
      LATERAL unnest(k.input_types || k.output_types) AS t(ty)
     WHERE NOT EXISTS (SELECT 1 FROM public.quiver_data_types() d WHERE d.data_type = t.ty);
    IF n <> 0 THEN RAISE EXCEPTION '% catalogue types are outside the enumeration', n; END IF;

    -- 2. An analysis opens with one canvas.
    SELECT public.create_quiver_analysis(proj, 'Machines') INTO a;
    SELECT id INTO cv FROM public.quiver_canvases WHERE analysis_id = a;
    IF cv IS NULL THEN RAISE EXCEPTION 'the new analysis has no canvas'; END IF;

    -- 3. Global IDs are stamped $A, $B, $C ... in order.
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-import-saved-object-set', 'Machines') RETURNING id INTO root;
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-filter-object-set', 'Running only') RETURNING id INTO filt;
    SELECT array_agg(global_id ORDER BY created_at) INTO ids
      FROM public.quiver_cards WHERE analysis_id = a;
    IF ids <> ARRAY['$A', '$B'] THEN RAISE EXCEPTION 'ids came out as %', ids; END IF;
    IF public.quiver_global_id(26) <> '$Z' OR public.quiver_global_id(27) <> '$AA'
       OR public.quiver_global_id(28) <> '$AB' THEN
      RAISE EXCEPTION 'the id sequence does not continue past Z';
    END IF;

    -- 4. Object set -> object set is legal.
    INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (filt, root);

    -- 5. THE WORKED EXAMPLE. A filter object set emits an object set; an
    --    object property consumes a single object; the page says this needs
    --    a conversion card in between.
    INSERT INTO public.quiver_cards (analysis_id, kind, title, output_type)
    VALUES (a, 'card-object-property', 'Serial', 'String') RETURNING id INTO prop;
    BEGIN
      INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (prop, filt);
      RAISE EXCEPTION 'an object set fed an object property';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:TypeMismatch%' THEN RAISE; END IF;
    END;
    -- with the object selector between them it is legal, both edges
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-object-selector', 'One machine') RETURNING id INTO sel;
    INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (sel, filt);
    INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (prop, sel);

    -- 6. A polymorphic kind must say which type it emits.
    BEGIN
      INSERT INTO public.quiver_cards (analysis_id, kind, title)
      VALUES (a, 'card-object-property', 'Unresolved');
      RAISE EXCEPTION 'an ambiguous output type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:OutputTypeAmbiguous%' THEN RAISE; END IF;
    END;

    -- 7. An unbuilt kind refuses BY NAME, and an unknown one refuses too.
    BEGIN
      INSERT INTO public.quiver_cards (analysis_id, kind) VALUES (a, 'card-rolling-aggregate');
      RAISE EXCEPTION 'an unbuilt kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:CardNotBuilt%Rolling aggregate%' THEN
        RAISE EXCEPTION 'the refusal did not name the card: %', SQLERRM;
      END IF;
    END;
    BEGIN
      INSERT INTO public.quiver_cards (analysis_id, kind) VALUES (a, 'card-invented');
      RAISE EXCEPTION 'an undocumented kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:UnknownCardKind%' THEN RAISE; END IF;
    END;

    -- 8. The graph stays acyclic, and a card is not its own input.
    BEGIN
      INSERT INTO public.quiver_card_inputs (card_id, slot, input_card_id) VALUES (root, 1, root);
      RAISE EXCEPTION 'a self-input was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:SelfInput%' THEN RAISE; END IF;
    END;
    -- a flow-start card takes no inputs, and says so by name
    BEGIN
      INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (root, filt);
      RAISE EXCEPTION 'a flow-start card accepted an input';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:TakesNoInputs%' THEN RAISE; END IF;
    END;
    -- and a REAL cycle, between two cards that both accept and emit an object
    -- set, so the acyclicity check is the thing that fires rather than the
    -- arity check standing in front of it
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-filter-object-set', 'Loop A') RETURNING id INTO l1;
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-filter-object-set', 'Loop B') RETURNING id INTO l2;
    INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (l2, l1);
    BEGIN
      INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (l1, l2);
      RAISE EXCEPTION 'a cycle was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:Cycle%' THEN
        RAISE EXCEPTION 'the cycle guard did not fire; got: %', SQLERRM;
      END IF;
    END;
    -- they leave, so the counts below are about the worked example alone
    DELETE FROM public.quiver_cards WHERE id IN (l1, l2);

    -- 9. Canvas membership is optional, and it is not the ordering.
    INSERT INTO public.quiver_canvas_cards (canvas_id, card_id) VALUES (cv, prop);
    -- everything upstream of prop is depended on, so nothing is unused yet
    SELECT count(*) INTO n FROM public.unused_quiver_cards(a);
    IF n <> 0 THEN RAISE EXCEPTION '% cards read as unused while feeding a canvas card', n; END IF;
    -- an aggregation on no canvas, that nothing depends on, IS unused
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-numeric-aggregation', 'Count') RETURNING id INTO agg;
    INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (agg, filt);
    SELECT count(*) INTO n FROM public.unused_quiver_cards(a);
    IF n <> 1 THEN RAISE EXCEPTION 'the orphan count is %, not 1', n; END IF;
    -- a dashboard reference is the third criterion, and it rescues the card
    INSERT INTO public.quiver_dashboards (analysis_id, name) VALUES (a, 'Ops') RETURNING id INTO bar;
    INSERT INTO public.quiver_dashboard_cards (dashboard_id, card_id) VALUES (bar, agg);
    SELECT count(*) INTO n FROM public.unused_quiver_cards(a);
    IF n <> 0 THEN RAISE EXCEPTION 'a dashboard-referenced card still read as unused'; END IF;
    DELETE FROM public.quiver_dashboard_cards WHERE card_id = agg;

    -- 10. Delete takes a mode. Remove-from-canvas keeps the card.
    n := public.delete_quiver_card(prop, 'remove_from_canvas');
    IF n <> 1 THEN RAISE EXCEPTION 'remove_from_canvas removed % placements', n; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.quiver_cards WHERE id = prop) THEN
      RAISE EXCEPTION 'remove_from_canvas deleted the card';
    END IF;
    -- delete empties the downstream slot and leaves the downstream card
    n := public.delete_quiver_card(filt, 'delete');
    IF n <> 2 THEN RAISE EXCEPTION 'deleting the filter emptied % slots, not 2', n; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.quiver_cards WHERE id = agg) THEN
      RAISE EXCEPTION 'deleting an input deleted the downstream card';
    END IF;
    BEGIN
      PERFORM public.delete_quiver_card(agg, 'archive');
      RAISE EXCEPTION 'an invented delete mode was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:UnknownDeleteMode%' THEN RAISE; END IF;
    END;

    -- 11. Save writes a version that carries the graph.
    SELECT public.save_quiver_analysis(a) INTO v;
    SELECT jsonb_array_length(snapshot -> 'cards') INTO n
      FROM public.quiver_analysis_versions WHERE id = v;
    IF n <> 4 THEN RAISE EXCEPTION 'the snapshot holds % cards, not 4', n; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '696 proved, as the caller: the catalogue holds 203 kinds and 28 types with nothing outside the enumeration; ids stamp $A $B and continue $Z $AA $AB; the data model page''s worked example refuses filter->property with Quiver:TypeMismatch and accepts it through an object selector; an ambiguous output type, an unbuilt kind (named), an unknown kind, a self-input, an input to a flow-start card and a real two-card cycle are all refused; the three-part unused test counts 0, 1 and 0 as a dashboard reference comes and goes; both delete modes behave as the page describes and an invented one does not; and Save snapshots the graph';
  END;
END $$;
