<!-- source: https://palantir.com/docs/foundry/slate/references-convert-rows-columns/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Convert between row and column schemas

There are myriad ways to implement solutions in JavaScript. These examples highlight generic algorithms for common patterns seen in Slate applications. Many of these solutions use the built-in [Lodash ↗](https://lodash.com/docs/4.17.4) and [Moment ↗](https://momentjs.com/docs/) JavaScript libraries.

* [Transforming Rows to Columns](#transforming-rows-to-columns)
* [Transforming Columns to Rows](#transforming-columns-to-rows)

## Transforming rows to columns

```js
/**
 * Transforms a row-oriented schema into a column-oriented schema (as returned by queries).
 * Note: The first object of the array needs to contain all keys to be extracted (future columns).
 * If the first object does not contain a superset of all keys, you can use the alternative commented code in the function.
 *
 * Before:
 * [
 *   { foo : 1, bar : 4, baz : 7 },
 *   { bar : 5, baz : 8, foo : 2 },
 *   { foo : 3, baz : 9, bar : 6 }
 * ]
 *
 * After:
 * {
 *   foo : [1, 2, 3],
 *   bar : [4, 5, 6],
 *   baz : [7, 8, 9]
 * }
 *
 */
function transformRowSchemaToColumnSchema(arr, first_object_has_all_keys=true) {
  if (_.isEmpty(arr)) {
    return [];
  }

  var orderedKeys;
  if(first_object_has_all_keys){
    // In case the first object has all keys
    orderedKeys = _.chain(arr)
        .first()
        .keys()
        .sortBy()
        .value();
  } else {
    // Alternative if not all objects have all keys : 
    orderedKeys = _.uniq(_.flatMap(arr, _.keys))
  }

  var sortKeysBy = function(obj) {
    return _.zipObject(orderedKeys, _.map(orderedKeys, function(key) {
      return obj[key];
    }));
  };

  var indexToKeyMapping = _.reduce(orderedKeys, function(agg, key, i) {
    agg[i] = key;
    return agg;
  }, {});

  var arrayOfRowObjects    = _.map(arr, sortKeysBy);
  var arrayOfRowArrays     = _.map(arrayOfRowObjects, function(obj) { return _.values(obj) });
  var arrayOfColumnArrays  = _.unzip(arrayOfRowArrays);
  var objectOfColumnArrays = _.reduce(arrayOfColumnArrays, function(agg, columnArr, i) {
    var key = indexToKeyMapping[i];
    agg[key] = columnArr;
    return agg;
  }, {});

  return objectOfColumnArrays;
}

var data = {{f_data}}
return transformRowSchemaToColumnSchema(data)
```

## Transforming Columns to Rows

```js
/**
 * Transforms a column-oriented schema (as returned by queries) into a row-oriented schema (often for use in an {{#each}} loop)
 *
 * Before:
 * {
 *   foo : [1, 2, 3],
 *   bar : [4, 5, 6],
 *   baz : [7, 8, 9]
 * }
 *
 * After:
 * [
 *   { foo : 1, bar : 4, baz : 7 },
 *   { foo : 2, bar : 5, baz : 8 },
 *   { foo : 3, bar : 6, baz : 9 }
 * ]
 */
 
function transformColumnSchemaToRowSchema(data) {
  var keys   = _.keys(data);
  var arrays = _.values(data);

  // if `data` comes directly from a SQL query, remove the `._response` property
  // delete data._response;

  var arrayOfPropertyLists = _.zip.apply(_, arrays);

  var arrayOfObjects = _.map(arrayOfPropertyLists, function(list) {
    var obj = {};

    _.each(keys, function(key, i) {
      obj[key] = list[i];
    });

    return obj;
  });

  return arrayOfObjects;
}

var data = {{f_data}}
return transformColumnSchemaToRowSchema(data)
```
