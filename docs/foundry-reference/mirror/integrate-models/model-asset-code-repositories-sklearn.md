<!-- source: https://palantir.com/docs/foundry/integrate-models/model-asset-code-repositories-sklearn/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Train a binary classification model with scikit-learn in Code Repositories

The following documentation provides an example on how to train a scikit-learn binary classification model using the open source [UCI ML Breast Cancer Wisconsin (Diagnostic) ↗](https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_breast_cancer.html) dataset in the [Code Repositories](/docs/foundry/code-repositories/overview/) application using the `Model Training Template`.

For a detailed walkthrough of the following steps, including how to author a model adapter and write Python transforms for model training, refer to our documentation on [how to train a model in Code Repositories](/docs/foundry/integrate-models/model-asset-code-repositories/).

## 1. Author a model adapter

First, author a [model adapter](/docs/foundry/integrate-models/model-adapter-overview/) using the [`Model Training Template`](/docs/foundry/integrate-models/model-asset-code-repositories/#1-author-a-model-adapter) in Code Repositories.

The example logic below assumes the following:

* This model adapter is initialized with a scikit-learn `model`.
* The data being provided to this model is tabular.
* The output of this model is tabular with all columns from `columns`, `prediction`, `probability_0`, and `probability_1`, where,
  * `prediction` is 0 or 1, with 0 being no cancer detected, and 1 being cancer detected.
  * `probability_0` is the probability that cancer was not detected.
  * `probability_1` is the probability that cancer was detected.
* The following dependencies have been added to the repository: `foundry-transforms-lib-python`,`pandas 1.5.3`, `scikit-learn 1.3.2`, and `dill 0.3.7`

```python
import palantir_models as pm
from palantir_models.serializers import *


class SklearnClassificationAdapter(pm.ModelAdapter):

    @pm.auto_serialize(
        model=DillSerializer()
    )
    def __init__(self, model):
        self.model = model

    @classmethod
    def api(cls):
        columns = [
            'mean_radius', 'mean_texture', 'mean_perimeter', 'mean_area',
            'mean_smoothness', 'mean_compactness', 'mean_concavity',
            'mean_concave_points', 'mean_symmetry', 'mean_fractal_dimension',
            'radius_error', 'texture_error', 'perimeter_error', 'area_error',
            'smoothness_error', 'compactness_error', 'concavity_error',
            'concave_points_error', 'symmetry_error', 'fractal_dimension_error',
            'worst_radius', 'worst_texture', 'worst_perimeter', 'worst_area',
            'worst_smoothness', 'worst_compactness', 'worst_concavity',
            'worst_concave_points', 'worst_symmetry', 'worst_fractal_dimension'
        ]
        inputs = {"df_in": pm.Pandas(columns=columns)}
        outputs = {"df_out": pm.Pandas(columns= columns + [
                                            ("prediction", int),
                                            ("probability_0", float),
                                            ("probability_1", float)
                                        ])}
        return inputs, outputs

    def predict(self, df_in):
        X = df_in.copy()

        predictions = self.model.predict(X)
        probabilities = self.model.predict_proba(X)

        df_in['prediction'] = predictions
        for idx, label in enumerate(self.model.classes_):
            df_in[f"probability_{label}"] = probabilities[:, idx]

        return df_in
```

## 2. Write a Python transform to train a model

In the same repository in `model_training/model_training.py`, author the model training logic.

This example uses the open source [UCI ML Breast Cancer Wisconsin (Diagnostic) dataset ↗](https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_breast_cancer.html) provided in the scikit-learn library.

```python
from transforms.api import transform
from palantir_models.transforms import ModelOutput
from main.model_adapters.adapter import SklearnClassificationAdapter
from sklearn.datasets import load_breast_cancer
from sklearn.compose import make_column_transformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier


@transform.using(
    model_output=ModelOutput("/path/to/model_asset"),
)
def compute(model_output):
    X_train, y_train = load_breast_cancer(as_frame=True, return_X_y=True)
    X_train.columns = X_train.columns.str.replace(' ', '_')
    columns = X_train.columns

    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ]
    )

    preprocessor = make_column_transformer(
        (numeric_transformer, columns),
        remainder="passthrough"
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", RandomForestClassifier(n_estimators=50, max_depth=3))
        ]
    )
    model.fit(X_train, y_train)

    foundry_model = SklearnClassificationAdapter(model)
    model_output.publish(model_adapter=foundry_model)
```

## 3. Consume the Model

### Run inference in a Python transform

You can run inference with your model in a Python transform. For example, once your model has been trained, copy the below inference logic into the `model_training/run_inference.py` file and select **Build**.

:::callout{theme="neutral"}
To run a model within a transform repository in which the model was not defined, set `use_sidecar = True` in `ModelInput`. This will automatically import the model adapter and its dependencies while running them in a separate environment to prevent dependency conflicts. Review [the `ModelInput` class reference](/docs/foundry/integrate-models/transform-model-input/) for more details. This feature is available for non-Spark transforms (using the `@lightweight` or `@transform.using`decorator) from `palantir_models` version 0.2010.0 onwards.

If `use_sidecar` is not set to `True`, the model adapter and its dependencies must be imported into or defined within the current code repository.
:::

```python
from transforms.api import transform, Output, LightweightOutput
from palantir_models.transforms import ModelInput
from palantir_models import ModelAdapter
from sklearn.datasets import load_breast_cancer


@transform.using(
    model=ModelInput(
        "ri.models.main.model.cfc11519-28be-4f3e-9176-9afe91ecf3e1",
        # use_sidecar=True is recommended for models defined outside the current transform repository
        ),
    inference_output=Output("ri.foundry.main.dataset.5dd9907f-79bc-4ae9-a106-1fa87ff021c3"),
)
def compute(model: ModelAdapter, inference_output: LightweightOutput):
    X, y = load_breast_cancer(as_frame=True, return_X_y=True)
    X.columns = X.columns.str.replace(' ', '_')

    inference_results = model.transform(X)
    inference_output.write_pandas(inference_results.df_out)
```

### Perform live inference in a modeling objective

A Palantir model can be submitted to a modeling objective for the following:

* [Automatic model evaluation](/docs/foundry/evaluate-models/model-evaluation-automatic/)
* [Batch pipelines](/docs/foundry/manage-models/set-up-batch/)
* [Live hosting](/docs/foundry/manage-models/set-up-live/)

After [submitting this model to a modeling objective](/docs/foundry/manage-models/submit-model/), you can create a release to host this model for live inference. Once the deployment is ready, you can perform live inference and connect this model to an operational application.

The example below shows input for the binary classification model using the single I/O endpoint:

```
[
  {
    "mean_radius": 15.09,
    "mean_texture": 23.71,
    "mean_perimeter": 92.65,
    "mean_area": 944.07,
    "mean_smoothness": 0.53,
    "mean_compactness": 0.21,
    "mean_concavity": 0.76,
    "mean_concave_points": 0.39,
    "mean_symmetry": 0.08,
    "mean_fractal_dimension": 0.14,
    "radius_error": 0.49,
    "texture_error": 0.82,
    "perimeter_error": 2.51,
    "area_error": 17.22,
    "smoothness_error": 0.07,
    "compactness_error": 0.01,
    "concavity_error": 0.05,
    "concave_points_error": 0.05,
    "symmetry_error": 0.01,
    "fractal_dimension_error": 0.08,
    "worst_radius": 12.95,
    "worst_texture": 20.66,
    "worst_perimeter": 185.41,
    "worst_area": 624.87,
    "worst_smoothness": 0.18,
    "worst_compactness": 0.26,
    "worst_concavity": 0.01,
    "worst_concave_points": 0.05,
    "worst_symmetry": 0.29,
    "worst_fractal_dimension": 0.05
  }
]
```
