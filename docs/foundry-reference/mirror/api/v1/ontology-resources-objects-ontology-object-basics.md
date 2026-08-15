<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/objects/ontology-object-basics/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Ontology Object basics

An Object is a data container for a specific instance of an [Object Type](/docs/foundry/object-link-types/object-types-overview/). For instance, the Employee object type may contain data about several employees, and each one is represented as a single Object.

## Filter objects

Anytime you request a list of objects using the List Objects endpoint, you can add filters to limit which objects you get back. Filters are given as query parameters of the form:

```
properties.{propertyApiName}.{propertyFilter}={propertyValueEscapedString}
```

For instance, the following filter will return only objects with a property called "firstName" that has the exact value of "John".

```
properties.firstName.eq=John
```

Property names in URLs are case-insensitive, and as a shortcut, you can write `p.` instead of `properties.`. The above example could also be written like this.

```
p.firstname.eq=John
```

| Filter   | Description              | Valid property types                                  | Example Usage                      |
|----------|--------------------------|-------------------------------------------------------|------------------------------------|
| contains | Array contains value     | arrays                                                | properties.names.contains=John     |
| eq       | Exactly equal            | all types except arrays and attachments               | properties.firstName.eq=John       |
| neq      | Not exactly equal        | all types except arrays and attachments               | properties.firstName.neq=John      |
| lt       | Less than                | date, timestamp, byte, integer, long, double, decimal | properties.age.lt=40               |
| lte      | Less than or equal to    | date, timestamp, byte, integer, long, double, decimal | properties.age.lte=40              |
| gt       | Greater than             | date, timestamp, byte, integer, long, double, decimal | properties.age.gt=40               |
| gte      | Greater than or equal to | date, timestamp, byte, integer, long, double, decimal | properties.age.gte=40              |
| isNull   | Value is null            | all types except attachments                          | properties.firstName.isNull=false  |

If multiple `contains` or `eq` filters are applied to the same property, then objects that have any of the given values for the specified property will be matched. If two range filters are applied to the same property (e.g. `lt` and `gte`), then only objects that match both constraints will be returned.

As a more complex example, the following filter will match people named John or Anna who were born in the 1980s, whose interests include tennis or golf, and who have a (non-null) street address. It is written on multiple lines for readability.

```
?p.firstName.eq=John
&p.firstName.eq=Anna
&p.birthDate.gte=1980-01-01
&p.birthDate.lt=1990-01-01
&p.interests.contains=tennis
&p.interests.contains=golf
&p.streetAddress.isNull=false
```
