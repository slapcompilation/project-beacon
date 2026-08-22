<!-- source: https://palantir.com/docs/foundry/slate/best-practices-complex-layouts/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Build complex layouts

Designing the look and feel of your application is an exciting prospect, and Slate gives you the flexibility to customize and override many aspects of widget appearance. Many projects, however, go off track when achieving a pixel-perfect match to a design mockup becomes more important than clean, efficient implementation of workflow features.

Another way to think of this is that every style override is a tradeoff against the simplicity and maintainability of your application. Be cautious and thoughtful in choosing your layout and styling and take the time to periodically refactor and clean up your application before moving on to another round of new feature development.

## Building Complex Layouts

Use [Container widgets](/docs/foundry/slate/widgets-container/) to lay out your application. Strike a balance between enough containers to logically organize your application and nesting containers unnecessarily. Keep in mind that as you build your application, every widget will eventually add several layers to the [Document Model (DOM) ↗](https://www.w3schools.com/js/js_htmldom.asp) and that the complexity of the DOM has a direct relationship with the browser resource usage, page load, and general responsiveness of your application - that is, how “heavy” your application is. When in doubt, use fewer widgets and try to avoid nesting containers more than 3 or 4 levels deep.

In almost all cases you should avoid using CSS to affect the *layout* of your application - stay away from `position` and either use the static widget positioning or a flex container for relative positioning. There are some exceptions here in specific cases, but for the general layout of an application, you will avoid unnecessary complexity and improve legibility of your app by sticking to the built-in positioning tools.

### Aligning widgets

An often overlooked feature of Slate is the ability to align widgets to each other. Hold the CTRL (CMD on Mac) key and click to select one or more widgets. With multiple widgets selected, the right panel will no longer show the widget configuration, but instead present several options to align or distribute the widgets.

Further, if you would like your layout to happen “automatically”, you can use the *Flex Container* to lay out the child widgets. See the section below on Responsive Layouts for much more on working with Flex containers.

### Showing and Hiding Widgets

Dynamic layouts often include showing or hiding content based on the state of the application. There are a number of ways to achieve this. Three patterns below share a few options and discuss the relative strengths and drawbacks.

#### Simple: Hiding with a Class

In the simplest case, you can hide a widget by templating the `Additional Classes` property in the widget display configuration to `hidden`. The common pattern would be to determine using a function (or your state variable) if a widget should display, and then template the output of that function into the widget. While this is simple, it does not scale well to multiple widgets and you will see a brief flicker for widgets that are “hidden” on page load, since they will remain visible until the dependency graph resolves and the class is applied.

#### Improvement: Hiding with a Tabbed Container

Better instead, especially with multiple widgets, is to use a Tabbed container where one tab is blank and the other contains the widgets to display. The pattern here is to apply a bit of CSS to hide the container border and background (i.e. make the container “invisible” relative to the background):

```css
// This will remove the border and background from any container with 'minimal' as
// an 'Additional Class'

.minimal sl-app-container {
    border: none;
    background: none;
}
```

Then template the `selectedTabIndex` property to toggle between hidden and visible. With this pattern there will be no flicker on page load and the widgets will hide instantly.

#### Complex: Hide from Root Element

If you need a widget to not only “hide”, but to be removed from the DOM completely, you can accomplish this by templating an additional class on the parent container to hide the widget by the root element selector. This pattern is most common in a responsive layout where you need to hide a widget *and* cause the other child widgets on the same level to reposition themselves.

The root element of every slate widget has an ID selector formatted like: `widget-[widgetName]`. So suppose we have a widget called *w\_myHTMLWidget* that is a child of the *w\_sidebar* container. To hide the widget completely, you define a class in the global styles:

```
.hide-myHTMLWidget {
    #widget-myHTMLWidget {
        display: none;
    }
}
```

Then in *w\_sidebar* you can conditionally add this class and the entire widget will hide. See the **Working With Styles** section below for more patterns and examples for using conditional CSS classes.

### “Multi-Page” Applications

The most common pattern for segmenting an application is to use a *Tabbed Container.* Each container tab can be treated as a separate page, however it is important to remember that these “pages” are simply a UI function - it will not affect the resolution of the dependency graph for instance, so even if a chart is on a different tab, the query to populate that chart will still run with the resolution of the dependency graph.

If you are building a multi-page application using a tabbed container, make sure to check the `Lazy rendering enabled` option - this moves the rendering of the widgets on a tab to *when the tab opens* rather than *when the page loads*. This is especially useful for very large applications where the majority of widgets are “hidden” on another tab at any given point and can substantially improve page load times.

You should use Tabbed containers even if you do not want to allow the user to select a given tab manually - if, for instance, you are building a workflow app and need to control when the user is moved to the next tab. In this case, you can uncheck the `Show tab titles` option and then use a Handlebars statement to template which tab (zero indexed) should be displayed at any given point. A common pattern is to track this tab as part of your application state (see **Building Stateful Applications** above) so that you can simply update the value of the current tab in your state variable and the tab will change in your application.

## Responsive Layouts

Search for the *Working with Flex Containers* tutorial in your Foundry instance.
