<!-- source: https://palantir.com/docs/foundry/model-studio/trainers-classification/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Classification trainer

The classification trainer trains a number of models in parallel or sequentially to help it determine the best performing model. This trainer may also take advantage of ensembling if it determines that a weighted ensemble of models performs better than any single model. This trainer is built using [AutoGluon's ↗](https://auto.gluon.ai/dev/index.html) `TabularPredictor` class.

The classification trainer may also perform model training techniques such as stacking or bagging to further improve performance. Stacking is an ensembling process where the predictions produced by the set of models trained on the input data are used to train a further "layer" of models, and this process may be repeated. Bagging is an internal optimization method where each model architecture is trained on multiple random samples of the data and outputs are combined in an ensemble. Stacking and bagging is controlled by the **Training preset** parameter.

The structure of the model ensemble can be viewed on the output model's experiment page under **Plots**.

## Models trained

Internally, multiple models will be trained, unless disabled by excluding the model or with the use of [hyperparameters](#advanced-hyperparameters).

The following types of models are available for training:

* **GBM:** [LightGBM ↗](https://lightgbm.readthedocs.io/en/latest/) gradient boosting model
* **CAT:** [CatBoost ↗](https://en.wikipedia.org/wiki/CatBoost) model
* **XGB:** [XGBoost ↗](https://xgboost.readthedocs.io/en/latest/) model
* **RF:** [Random Forest ↗](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html) model
* **XT:** [Extra Trees ↗](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.ExtraTreesClassifier.html#sklearn.ensemble.ExtraTreesClassifier) model
* **KNN:** [KNearestNeighbors ↗](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.KNeighborsClassifier.html) model
* **LR:** [Linear ↗](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html) model
* **NN\_TORCH:** [PyTorch ↗](https://pytorch.org/) model designed for tabular classification
* **FASTAI:** [fast.ai ↗](https://www.fast.ai/) model designed for tabular classification

## Parameters

* **Evaluation metric:** The metric used to score the models during training performance. Different datasets may perform better on different evaluation metrics. Refer to the in-platform documentation for more details. The higher an evaluation metric is, the better the model's performance. All classification evaluation metrics follow this pattern.
* **Training preset:** Training presets are an abstraction above more complex arguments around bagging and stacking.
  * `best_quality`: Enables stacking and bagging. This should be used when the best possible model is required, even at the cost of training and inference speed.
  * `high_quality`: Enables stacking and bagging. Training time and inference time should be faster than the `best_quality` preset, but the model may be slightly less accurate.
  * `good_quality`: Enables stacking and bagging. This preset has a faster training and inference speed than the previous presets, with decent predictive accuracy.
  * `medium_quality`: Disables stacking and bagging. This preset has the fastest training time, but moderate predictive accuracy. This should be used for prototyping.
* **Training and inference limits:**
  * **Training time limit:** Optionally set the maximum amount of time spent training. This time limit may be respected on a best effort basis when using presets that enable stacking and bagging. When the time limit is reached, the training portion of the job will end. Note that the job will not finish until model validation is complete and the model has been published.
  * **Inference time limit:** Optionally set the maximum amount of time that a given model may run during inference. Any model that surpasses this time limit will be skipped. We do not recommend setting this value unless strict inference time limits are required.
* **Excluded model types:** Excludes certain model types from being used during training.
* **Prediction column name:** An override for the prediction column name. By default, the target column name will be used.
* **Predict probabilities:** If true, class probabilities will be returned instead of a single class prediction. Additional output columns will be added following the format `{prediction_column_name}_proba_{class_label}` where `prediction_column_name` is the name of the prediction column and `class_label` is the class that the probability is predicting. Note that by default, the prediction column name is the name of the target columns.

### Advanced: Stacking configuration

The optional stacking configuration fields allow for deeper control over how the model ensemble is constructed:

* **Fit weighted ensemble:** When enabled, a `WeightedEnsemble` model will be produced at each stacking layer. We recommend enabling this for improved model performance.
* **Fit last ensemble with all models:** When enabled, the `WeightedEnsemble` of the last stacking layer will be fit with models from all previous layers as base models. This value has no effect when using a preset that disables stacking. We recommend enabling this for improved model performance.
* **Fit full weighted ensemble:** When enabled, a secondary `WeightedEnsemble` model will be produced on top of the weighted ensembles produced when **fit last ensemble with all models** is enabled. This option has no effect if **fit last ensemble with all models** is disabled, or when using a preset that disables stacking.

### Advanced: Hyperparameters

The optional hyperparameter field allows for deeper customization and control over each trained model, with one caveat. When this field is defined, any model not supplied in the hyperparameter field will be ignored. This field will override the default hyperparameters chosen by AutoGluon, and can produce poor results. For this reason, we recommend avoiding this field if you have not consulted the [AutoGluon documentation ↗](https://auto.gluon.ai/dev/api/autogluon.tabular.TabularPredictor.fit.html#autogluon.tabular.TabularPredictor.fit). In the majority of cases, the default hyperparameters provide strong enough results.

In general, the arguments passed here will be sent directly to the underlying model implementation.

Take the example below:

```json
{
    "GBM": [
        {"extra_trees": true}, {}
    ],
    "NN_TORCH": {}
}
```

These hyperparameters will enforce that the following models are trained:

1. A GBM model with the argument `extra_trees` set to true.
2. A GBM model with default arguments.
3. A PyTorch model with default arguments.

With the provided hyperparameters, these are the only models that will be trained before any ensembling or stacking operations are applied.

## Outputs

The classification trainer will output a Foundry model that contains the best model as determined by the validation steps. Details about the model can be accessed by [navigating to the experiment](/docs/foundry/model-studio/navigation/#sidebar), which will contain parameters, metrics, and plots that provide insight into the model's performance.
