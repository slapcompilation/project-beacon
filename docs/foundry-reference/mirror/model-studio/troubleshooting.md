<!-- source: https://palantir.com/docs/foundry/model-studio/troubleshooting/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Troubleshooting

This page contains tips for troubleshooting errors that you may encounter while using Model Studio. If you have an error that you cannot resolve with this guide, report an issue to Palantir Support.

## No models trained

The `No models trained` error indicates that all model types were excluded when configuring your model studio. This can happen by excluding the models directly, or by using the hyperparameter field. To resolve this, set the hyperparameter field to `{}`, or reduce the number of excluded models. Refer to the [time series forecasting](/docs/foundry/model-studio/trainers-timeseries-forecasting/#advanced-hyperparameters), [classification](/docs/foundry/model-studio/trainers-classification/#advanced-hyperparameters), or [regression](/docs/foundry/model-studio/trainers-regression/#advanced-hyperparameters) trainer documentation, depending on the trainer being used by your model studio.

## Out of memory

Due to how datasets are stored in Foundry, you may run into out of memory (OOM) errors if you did not properly scale your memory to fit the dataset. Datasets produced in Foundry tend to be highly compressed, meaning that datasets may take up more memory when uncompressed. Provisioning more memory may also unlock general performance gains, as parallelized workers within the trainer can operate more efficiently. Learn more about [configuring compute resources](/docs/foundry/model-studio/configuration-compute-resources/).

## Frequency of train data is not provided and cannot be inferred

The `Frequency of train_data is not provided and cannot be inferred` error occurs when the time series trainer is unable to determine the frequency of your data when setting the resample configuration frequency argument to `auto`. To resolve this, disable resampling or manually set the resampling frequency. Refer to the time series forecasting trainer [parameters](/docs/foundry/model-studio/trainers-timeseries-forecasting/#parameters) for more information.
