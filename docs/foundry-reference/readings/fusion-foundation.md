---
verify: strict
---

# Fusion, the foundation: sheets, cells, table regions, and the sync that makes a dataset

The fourth buildable Home application, and the one whose value here is
narrow and clear: a spreadsheet whose table region **becomes a dataset
other applications consume**. That sync is the connective half; the
spreadsheet is the surface it needs.

**What I read, counted rather than asserted.** The section holds **22
pages**. Read whole: `overview`, `sheets-overview`,
`create-use-table-regions`, `sync-table-dataset`, `formulas-overview`,
`project-scope`. Read for their scale rather than their content:
`function-library` — **202 functions across five categories** (Core,
Action, Validation, Chart, Time series), which is a catalogue, not a
foundation. **Images: the section has 44; I parsed 0** — the pages I built
from state their rules in prose, and the captures are per-dialog crops of
flows this arc does not build. Named as unparsed rather than claimed. 15
pages remain unread.

## 1. What it is, and the caveat on its own overview

> "**Fusion** is a spreadsheet application for Foundry."

— `fusion/overview.md`

The four things it lets a spreadsheet do are listed there: query datasets
by search and lookup, use cell references and functions, build interactive
sheets with dropdowns and linked cells, and "Submit results and write back
datasets to Foundry for downstream usage".

And the overview closes with a pointer that matters for scoping:

> "If you are adding data to the Ontology, consider using [Actions](/docs/foundry/action-types/overview/)."

— `fusion/overview.md`

Fusion is **not** sunset — checked at product level, unlike Forms, Reports
and Data prep. But its own page steers ontology writeback to Actions, so
the part worth building here is the dataset half, not a second writeback
path into objects.

## 2. Sheets and cells

> "A Fusion spreadsheet looks and behaves like other spreadsheet applications, meaning that you can type anything anywhere, use cell references and functions, and so on. However, note that Fusion uses single quotes (`'`) to indicate strings, not double quotes (`"`)."

— `fusion/sheets-overview.md`

The cell types are enumerated on that page: String, Number, Date,
Timestamp, Boolean, Array, Null — with their literal forms (`2013-02-18`
for a date, `=array(1, 2)` for an array). References work as expected:

> "Sheets can be renamed by double-clicking the sheet name. Cell references work as one would expect (e.g `=A1`, `=A1:A3`, `=Sheet2!A1:A3`) and you can use the mouse when editing in the formula bar."

— `fusion/sheets-overview.md`

Collaboration is stated too — several users at once, seeing each other's
cursors, with a rule about visibility: "Changes in cells only become
visible to other users once they have been submitted".

## 3. Table regions

> "You can create a table out of any region in the spreadsheet – table regions enforce a strictly tabular format to a region and allow you to assign column headers, refer to columns by column names (vs cell references), sort the rows by any column, etc."

— `fusion/create-use-table-regions.md`

Two behaviours are called out, and the second is a genuine surprise:

> "When a new row is appended to a table region, it’ll grow the region, pushing down any values underneath as necessary."

— `fusion/create-use-table-regions.md`

> "Sorting in Fusion works differently from other spreadsheet tools that you may have used. Rather than simply presenting a sorted view of the data, performing a sort in Fusion actually rearranges the rows in a sheet so that the cells are in a sorted order. This means that a sort in Fusion cannot be "turned off" to return to the original ordering; instead, you will need to undo the sort in order to see the original ordering again."

— `fusion/create-use-table-regions.md`

A sort is a mutation, not a view. That is worth building faithfully,
because getting it wrong would be a quiet divergence nobody notices until
their data is in a different order than they think.

## 4. The sync — the reason to build this at all

> "Fusion allows you to create datasets based on your spreadsheets. You can either sync a whole sheet to a dataset or select a table range to be synced. After the data is successfully synced to a dataset in Foundry, the data will be available for consumption by other applications, such as Contour."

— `fusion/sync-table-dataset.md`

with an exclusivity rule:

> "You may only use one type of sync within a Fusion sheet: a sheet sync, or a table sync. Using both types is not allowed as it would cause overlaps in dataset syncs."

— `fusion/sync-table-dataset.md`

and the behaviour that connects it to our engine:

> "Once you sync a table range to a dataset, any changes made to that table range will trigger a build and be reflected in its associated dataset as long as you have at least `Editor` permissions on the associated dataset. As you edit the table range, you may see a number of finished and aborted transactions on the dataset."

— `fusion/sync-table-dataset.md`

That last sentence is the design: an edit produces a **transaction** on the
dataset, and repeated edits produce many — some aborted. Our dataset engine
is transactions over branches with a schema and files, which is the same
shape.

Column types are the author's to set:

> "You can also set the column types of the output dataset using the dropdown menu on the column headers of the table region in your spreadsheet."

— `fusion/sync-table-dataset.md`

## 5. What our substrate holds, probed

Nothing spreadsheet-shaped exists. What the sync needs, we have: `datasets`
with `dataset_branches`, `dataset_transactions` (SNAPSHOT/APPEND with
OPEN/COMMITTED/ABORTED), `dataset_schemas`, `dataset_files`,
`dataset_materialize` to build the physical table, and `run_build` for
downstream. Projects and roles give the Editor permission the sync rule
names.

## Decisions

1. **`fusion_spreadsheets`** — a project resource, like every other
   application's document. Sheets are rows under it, cells rows under a
   sheet, keyed by (sheet, row, column) with an integer column index so
   `A1` is a rendering rather than a stored string.
2. **A cell stores its input and its type.** The seven types the page
   enumerates become a declared set; a cell holds `raw` text as typed and,
   where it begins with `=`, that same text is its formula. Storing the
   input rather than only a computed value is what makes a spreadsheet
   editable.
3. **Formula evaluation is NOT built in this arc, and the number says why:
   202 functions across five categories.** Cells carrying a formula store
   it and render it; nothing computes. This is the widget-catalogue
   decision again — an indexed backlog beats 202 stubs — and it is stated
   on the surface rather than left to look broken.
4. **Table regions are rows with bounds and column headers**, and **a sort
   rewrites the cells** rather than storing an order. The page is explicit
   that a sort cannot be turned off, and reproducing that faithfully means
   mutating.
5. **The sync is the point**: `sync_table_region(region)` opens a
   transaction on the target dataset, writes the schema from the region's
   column headers and their chosen types, records a file, commits, and
   materialises — the same path 692's probe walks by hand. The
   sheet-or-table exclusivity is a constraint, not a convention.
6. **Editor on the dataset is required**, because the page says so, and it
   composes the project role predicate we already have rather than
   restating it.
7. **Recorded, not built**: lookups and index datasets (querying datasets
   from cells), dropdowns and locked cells, formatting, templates,
   presentation view, XLS import, time-series visualisation, Actions from
   cells (the page steers those to Actions anyway), and multi-user cursors.
   Each is a page in the 15 unread.

## Questions

1. **Does a sheet sync produce one dataset per sheet?** The page says a
   sheet sync or a table sync, never both, but not whether several tables
   in one sheet each get a dataset. Ours: one dataset per region, with the
   exclusivity enforced per sheet. `blocks: nothing.`
2. **What happens to a synced region when a sort rewrites it?** Both
   behaviours are documented separately and never together. Ours: the sort
   mutates, and the next sync sees the new order. `blocks: nothing.`
3. **Are aborted transactions a normal outcome or a failure?** "you may see
   a number of finished and aborted transactions" reads as normal. Ours:
   an abort is recorded, not raised. `blocks: nothing.`
