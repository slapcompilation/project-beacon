<!-- source: https://palantir.com/docs/foundry/questions-answers/object-views-community/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Object Views (Community)

### Is it possible to navigate between different tabs of Workshop backed object views of an Object Type using a button widget?

This is not currently possible. One workaround would be to make your Object View a single tab, which is a single Workshop module, and then put your tabs in that module. Workshop buttons can toggle between Workshop tabs, so you could configure your module as you would like with the ability to flip between tabs.

If you already have multiple Object View Modules, you could make a parent module that embeds each of these pre-existing modules, which would limit the amount of refactoring this would involve.

*Topic Link:* [https://community.palantir.com/t/navigate-to-different-object-view-tab-with-button/1111 ↗](https://community.palantir.com/t/navigate-to-different-object-view-tab-with-button/1111)

*Timestamp:* October 17, 2024
