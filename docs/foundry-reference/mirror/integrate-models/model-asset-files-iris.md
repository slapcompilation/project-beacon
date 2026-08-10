<!-- source: https://palantir.com/docs/foundry/integrate-models/model-asset-files-iris/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Example: Upload a scikit-learn model

The below documentation provides an example of how to integrate a model into Foundry from existing model files. For a step-by-step guide, refer to our documentation on how to [publish a model from pre-trained files](/docs/foundry/integrate-models/model-asset-files/).

## Create the model from model files

The following example uses a model that was trained locally using the [Iris classification dataset ↗](https://archive.ics.uci.edu/dataset/53/iris) published by UC Irvine. The dataset has four features; `sepal_length`, `sepal_width`, `petal_length` and `petal_width` and can be used to build a model that predicts the specific specifies of the iris flower.

In this example, we assume the model was trained locally as a [K-nearest neighbors classifier ↗](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.KNeighborsClassifier.html) with the [scikit-learn library ↗](https://scikit-learn.org/stable/index.html). This example also assumes the model was trained with `Python 3.8.0` and `scikit-learn 1.3.2`.

After training, the model is saved as a [pickle file ↗](https://docs.python.org/3/library/pickle.html), as defined below.

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier

import pickle

iris = load_iris()
X = iris.data
y = iris.target

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.4, random_state=4)

knn = KNeighborsClassifier(n_neighbors = 5)
knn.fit(X_train, y_train)

with open("iris_model.pkl", "wb") as f:
    pickle.dump(knn, f)
```

### 1. Upload the model files to an unstructured dataset

The scikit-train model files are uploaded to Palantir as an unstructured dataset, as shown in the image below:

![The iris classification model dataset, saved as a pickle file in the Palantir platform. ](/docs/resources/foundry/integrate-models/iris-model-dataset.png)

## 2. Create a Model Training template to define your model adapter logic

In the Code Repositories application, create a new **Model Integration** repository with the **Model Training** language template, then add a dependency on `scikit-learn 1.3.2`. Define your logic to read the model files and publish a model.

### 3. Publish your model files as a model

Once the model adapter logic is executed, the model will be published in the platform.

```python
from transforms.api import transform, Input
import palantir_models as pm
from palantir_models.transforms import ModelOutput
from palantir_models.serializers import DillSerializer
import pickle
import os


@transform(
    model_files=Input("<Your Input Path>"),
    model_output=ModelOutput("<Your Output path>")
)
def compute(model_files, model_output):
    fs = model_files.filesystem()
    with fs.open("iris_model.pkl", "rb") as f:
        model = pkl.load(f)

    model_adapter = IrisModelAdapter(model, "target")
    model_output.publish(
        model_adapter=model_adapter
    )


class IrisModelAdapter(pm.ModelAdapter):

    @auto_serialize(
        model=DillSerializer(),
        prediction_column_name=DillSerializer()
    )
    def __init__(self, model, prediction_column_name="target"):
        self.model = model
        self.prediction_column_name = prediction_column_name

    @classmethod
    def api(cls):
        column_names = ["sepal_length", "sepal_width", "petal_length", "petal_width"]
        columns =[(name, float) for name in column_names]
        inputs = {"df_in": pm.Pandas(columns=columns)}
        outputs = {"df_out": pm.Pandas(columns=columns+[("target", int)])}
        return inputs, outputs

    def predict(self, df_in):
        inference_data = df_in

        predictions = self.model.predict(inference_data.values)
        inference_data[self.prediction_column_name] = predictions
        return inference_data
```

### 4. Consume the published model

Once the model is published, it is ready to be consumed for inference in the platform. For this example, we will [create a new modeling objective](/docs/foundry/manage-models/create-a-modeling-objective/) and submit the model.

1. Create a new modeling objective by navigating to the Project folder where you wish the objective to live, then selecting **New > Modeling Objective**.  This will open the Modeling Objectives application.

![An empty state of the Modeling Objectives application.](/docs/resources/foundry/integrate-models/iris-modelling-objective-raw.png)

2. Next, submit a model to the objective. In the **Model Submissions > Submit a Model**  section, select **Add Model** to open a dialog, as shown below.

![An Add Foundry model pop-up, with options for ways to add models to the platform. ](/docs/resources/foundry/integrate-models/iris-modelling-objective-upload-1.png)

3. Select **Submit model from Foundry**, then select **Next** to open a dialog where you can load the published model from its location in the platform.

![A pop-up dialog to select a model to submit to the platform. ](/docs/resources/foundry/integrate-models/iris-modelling-objective-upload-2.png)

4. Once the model is submitted, you will be directed back to the modeling objective overview page, where a **Model submissions** section will show information about the submission.

![The recent model submission is now viewable from the overview page of the modeling objective. ](/docs/resources/foundry/integrate-models/iris-modelling-objective-uploaded.png)

5. Select the newly submitted model from the **Model submissions** section to open the model page.

![The model details page of the iris classification model in a modeling objective. ](/docs/resources/foundry/integrate-models/iris-modelling-objective-release-1.png)

6. Select **Create new release** in the upper right corner to open a new window to create a release.

![The pop-up dialog to create a new release for the model. ](/docs/resources/foundry/integrate-models/iris-modelling-objective-release-2.png)

7. After creating a release, return to the modeling objective overview page by selecting the name in the top left of the screen. Scroll down to **Deployments**, then select **Create deployment** to open another dialog window.

![The Create a new deployment page, with options for setting up a new model deployment.](/docs/resources/foundry/integrate-models/iris-modelling-objective-deploy-1.png)

8. Complete the setup form, then select **Create deployment** in the bottom right corner. Return to the modeling objective overview, scroll down to **Deployments**, then select the newly deployed model to test.

![The test details page for the model deployment. ](/docs/resources/foundry/integrate-models/iris-modelling-objective-deploy-2.png)

9. From the **Query** tab on the top left of the page, test the model by adding values and observing the outputs.

![The Query page for the deployment test, with sections for entering inputs and viewing results.](/docs/resources/foundry/integrate-models/iris-modelling-objective-test.png)

More details on creating and querying a live deployment can be found in the [live deployment documentation](/docs/foundry/manage-models/set-up-live/).
