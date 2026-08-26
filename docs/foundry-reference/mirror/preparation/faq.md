<!-- source: https://palantir.com/docs/foundry/preparation/faq/ · mirrored 2026-08-26 from Palantir Foundry docs -->

## Data Preparation FAQ

The following are some frequently asked questions about Preparation.

For general information, view our [data Preparation documentation](/docs/foundry/preparation/overview/).

* [Data Preparation questions](#data-preparation-faq)
* [What is Preparation?](#what-is-preparation)
* [Who should use Preparation?](#who-should-use-preparation)
* [What can I do with Preparation?](#what-can-i-do-with-preparation)
* [Can I change input dataset in Preparation?](#can-i-change-input-dataset-in-preparation)

***

## What is Preparation?

Preparation is an application for cleaning and preparing data powered by the Contour backend.

[Return to top](#data-preparation-faq)

***

## Who should use Preparation?

We aim for it to be walk-up usable or require minimal training by everyone on the enrollment. Upon initial load, a user will instantly understand the shape (row and column information) and cleanliness of their data. For example, quality flags such as extra white space or high null percentage will guide the user step by step to either fix or ignore these flags.

That said, people who only consume Notepad documents, for example, likely will not need to use Preparation. Some code repository processes, however, may be simplified through Preparation.

[Return to top](#data-preparation-faq)

***

## What can I do with Preparation?

Here are a few examples of how Preparation could be used to easily clean or prepare real data:

* Normalize zip codes to five digits.
* Identify and nullify 0 values for latitude/longitude.
* Create hyperlinks by appending an ID column to a URL.
* Normalize values by removing leading and trailing whitespace.
* Split a currency column (for example: “USD 1000”) into separate currency code and amount columns.

[Return to top](#data-preparation-faq)

***

## Can I change input dataset in Preparation?

Yes. On the right side **Change Log** panel, scroll down to the very bottom and edit the starting dataset. If you want to apply the same logic to a different dataset but keep the original one, you can duplicate your preparation beforehand by selecting the small dropdown menu next to its name.

[Return to top](#data-preparation-faq)
