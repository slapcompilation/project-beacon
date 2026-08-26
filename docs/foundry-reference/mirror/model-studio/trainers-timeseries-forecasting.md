<!-- source: https://palantir.com/docs/foundry/model-studio/trainers-timeseries-forecasting/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Time series forecasting trainer

The time series forecasting trainer trains a number of models in parallel or sequentially to help it determine the best performing model. This trainer may also take advantage of ensembling if it determines that a weighted ensemble of models performs better than any single model. This trainer is built using [AutoGluon's ↗](https://auto.gluon.ai/dev/index.html) `TimeSeriesPredictor` class.

The time series forecasting trainer relies on accurate historical time series data to predict future data across a number of pre-defined lookahead steps. The structure of the model ensemble can be viewed on the output model's experiment page under **Plots**.

## Models trained

Internally, multiple models will be trained, unless disabled by excluding the model or with the use of [hyperparameters](#advanced-hyperparameters).

The following types of models are available for training:

* **AutoETS:** Automatically tuned exponential smoothing model.
* **DeepAR:** Autoregressive forecasting model.
* **DirectTabular:** Tabular regression model (predicts all values at once).
* **ETS:** Naive exponential smoothing model.
* **NPTS:** Non-parametric time series forecasting model.
* **Naive:** Baseline model that sets the value at timestamp `t` equal to the observed value at `t-1`.
* **PatchTST:** Transformer-based time series forecasting model.
* **RecursiveTabular:** Similar to `DirectTabular`, but predicts values one by one.
* **SeasonalNaive:**  Baseline model that sets the value at timestamp `t` equal to the observed value at `t-1` from the same season.
* **TemporalFusionTransformer:** Deep-learning model that combines an LSTM layer and transformer to predict quantiles for future values.
* **Theta:** Theta forecasting model.
* **TiDE:** Time series dense encoder model.

## Datasets

The time series trainer requires more advanced configuration for input datasets than the [regression](/docs/foundry/model-studio/trainers-regression/) or [classification](/docs/foundry/model-studio/trainers-classification/) trainers. The regression and classification trainers only require a training dataset, while the time series forecasting trainer requires a training dataset and a corresponding static dataset.

### Training dataset

The training dataset should be a time series dataset with at minimum a timestamp column and a target value column. The target value column is what the model will predict.

Additionally, the training dataset accepts column mappings for the following options:

* **Item ID:** The item ID column mapping is useful when you have multiple time series tracked in a single dataset. For example, a dataset containing a history of sales may contain an item ID for the product, such as an SKU, allowing a model to be trained to predict individual items independently of each other.
* **Known covariates:** Known covariates are columns that are known throughout the entire forecast horizon. For example, columns could indicate the following:
  * Holidays and weekends: A column could indicate if a given day is a holiday or a weekend that is known throughout the entire forecast horizon.
  * Event dates: A column could indicate that a certain event occurred that day, such as a sporting event.
    The remaining columns are treated as *past* covariates, which are values that fluctuate and are not known in advance, such as temperature or sales of similar products.

### Static dataset

The static dataset contains metadata that are time-independent.

This may include data such as:

* Store locations
* Customer segment age group
* Pricing tier or subscription level

The static dataset must be formatted in such a way that each item ID as mapped in the [training dataset](#training-dataset) corresponds to a single row in the static dataset.

If you have a training dataset that looks like the following:

| date       | item\_id   | sales |
|------------|-----------|-------|
| 2025-09-01 | STORE\_1   |  14   |
| 2025-09-01 | STORE\_2   |   7   |
| 2025-09-02 | STORE\_1   |  16   |
| 2025-09-02 | STORE\_2   |   9   |
| 2025-09-03 | STORE\_1   |  13   |

The static dataset may look like the following, containing some useful metadata about the values in `item_id`:

| item\_id | zip\_code | store\_class |
|---------|----------|-------------|
| STORE\_1 | 10016    | LARGE       |
| STORE\_2 | 90210    | POP\_UP      |

Static data will then be associated with the training dataset and optional testing dataset, joined by the `item_id` column.

## Parameters

* **Forecast horizon length:** The number of future time steps to predict during inference.
* **Evaluation metric:** The metric used to score the models during training performance. Different datasets may perform better on different evaluation metrics. Refer to the in-platform documentation for more details. The higher an evaluation metric is, the better the model's performance. All evaluation metrics follow this pattern.
* **Time limit:** Optionally set the maximum amount of time spent training. When the time limit is reached, the training portion of the job will end. Note that the job will not finish until model validation is complete and the model has been published.
* **Training preset:** Training presets are an abstraction above more complex arguments around bagging and stacking.
  * `best_quality`: Uses a mix of statistical, deep-learning, and classical machine learning models with a longer validation step and multiple backtests. This preset will produce the most accurate model, but it may take a while to train.
  * `high_quality`:  Uses a mix of statistical, deep-learning, and classical machine learning models. This preset will produce more accurate models than the `medium_quality` preset, but it will be slower to train.
  * `medium_quality`: Uses a mix of statistical and classical machine learning models, as well as `TemporalFusionTransformer`. This preset produces a decently performing model with a faster training time.
  * `fast_training`: Uses only simple statistical and tree-base models. This preset offers fast training that may not be accurate and is only recommended for prototyping.
* **Quantile levels:** Quantile levels specify an extra set of quantile measurements (0.1, 0.2, 0.9, etc.) to add to the prediction output to provide a probabilistic distribution forecast. A value predicted for some quantile `0.1` means that the actual value is predicted to appear at less than the `0.1` value 10% of the time.
* **Resample options:** Options for resampling the time series to a regular frequency.
  * **Frequency alias:** An alias for data frequency. When set to auto, the trainer will attempt to infer the frequency of time series data. Otherwise, each option represents a common frequency for timestamps. For example, `B` means that the timestamp is per business day, `W` is weekly, and so on. These values are based on [pandas ↗](https://pandas.pydata.org/pandas-docs/stable/user_guide/timeseries.html#offset-aliases) offset aliases. This will be used to influence any resampling to change timestamps to fit a common frequency.
  * **Numeric aggregation method:** When resampling, values may have to be modified to "correct" the value to the new frequency. This controls how non-categorical values are aggregated across timestamps before being re-sampled to new timestamps.
  * **Categorical aggregation method:** Same as the numeric aggregation method, but for categorical values.
* **Missing value fill strategy:** Influences how to fill missing values in the target column.
* **Enable ensemble:** When true, a weighted ensemble of all trained models will be fit and compared against individual models before determining the best model.
* **Excluded model types:** Excludes certain model types from being used during training.

### Advanced: Hyperparameters

The optional hyperparameter field allows for deeper customization and control over each trained model, with one caveat. When this field is defined, any model not supplied in the hyperparameter field will be ignored. This field will override the default hyperparameters chosen by AutoGluon, and can produce poor results. For this reason, we recommend avoiding this field if you have not consulted the [AutoGluon documentation ↗](https://auto.gluon.ai/dev/api/autogluon.tabular.TabularPredictor.fit.html#autogluon.tabular.TabularPredictor.fit). In the majority of cases, the default hyperparameters provide strong enough results.

In general, the arguments passed here will be sent directly to the underlying model implementation.

Take the example below:

```json
{
    "DeepAR": {},
    "Theta": [
        {"decomposition_type": "additive"},
        {"seasonal_period": 1},
    ],
}
```

These hyperparameters will enforce that the following models are trained:

1. A DeepAR model.
2. A Theta model with `decomposition_type` set to `additive`.
3. A Theta model with `seasonal_period` set to `1`.

With the provided hyperparameters, these are the only models that will be trained before any ensembling operations are applied.

## Outputs

The time series forecasting trainer will output a Foundry model that contains the best model as determined by the validation steps. Details about the model can be accessed by [navigating to the experiment](/docs/foundry/model-studio/navigation/#sidebar), which will contain parameters, metrics, and plots that provide insight into the model's performance.

You can visualize and analyze the forecasts as time series using Foundry applications like Quiver, Vertex, and Workshop. [Learn more about using time series in Foundry](/docs/foundry/time-series/time-series-overview/).
