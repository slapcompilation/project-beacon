<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-slack/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Set up a Slack listener

This guide shows step-by-step how to configure a listener for Slack, to get a real-time feed of events from Slack to a Foundry streaming dataset.

[Learn more about Slack. ↗](https://slack.com/)

## Prerequisites

Prior to configuration, ensure:

* Your enrollment's ingress policy has been appropriately configured for the AWS region or country where your Slack instance is hosted. [Learn how to Configure ingress.](/docs/foundry/administration/configure-ingress/)

* You must have your own instance of Slack with administrator access.

## Instructions

1. Create a new Slack app for your integration. [Refer to external documentation. ↗](https://api.slack.com/quickstart) <br><br> <img src="./media/listeners-slack-1.png" alt="In Slack, set up a new Slack application." width=350> <br><br>

2. Note down the **signing secret** value for your app from the **Basic Information** section. You will need this to set up your listener successfully. <br><br> <img src="./media/listeners-slack-2.png" alt="In Slack's App Credentials view, copy down the `Client Secret`." width=400> <br><br>

3. Create a Slack listener from the Data Connection application in Foundry.

   a. In the field for **Message Signing Secret**, enter the **Signing Secret** value from the previous step.

   b. Take note of the URL displayed in the **Endpoints** field on this page.

   c. Select **save and continue**. <br><br>
   ![In the Palantir platform, navigate to the configuration page and enter the message signing secret.](/docs/resources/foundry/data-connection/listeners-slack-3.png) <br><br>

4. Administrator approval is now required from the Information Security Officer. Review the toggle description.

5. On the **Test** page for the listener, select **Start** to make sure your listener is enabled. You must do this before proceeding, since the next step will fail if the listener is not activated. <br><br>
   ![In the Palantir interface, select Activate next to the listener status to activate the listener.](/docs/resources/foundry/data-connection/listeners-slack-4.png) <br><br>

6. Once your listener status shows as active, you are ready to copy the listener URL into Slack to set up the push event subscription.
   a. Open Slack, and navigate to **Event subscriptions**.

   b. Toggle to turn on event subscriptions, and then enter the listener URL from step 3 into the **Request URL** field.

   c. Slack will verify that the listener is correctly set up, and you will see a “Verified” message above your URL as shown below.

   d. You then need to add the events and associated scopes so that Slack will push events to your listener. As a simple example, you can add the `app_mention` event, which requires the `app_mentions:read` scope. This will send an event when the bot is explicitly mentioned. <br><br>
   ![Slack's Event Subscriptions page to toggle on events.](/docs/resources/foundry/data-connection/listeners-slack-5.png) <br><br>

7. Remember to install your application into your Slack workspace. You should do this after specifying the desired events, since the application must be installed whenever the scopes are changed. <br><br> <img src="./media/listeners-slack-6.png" alt="Slack's permission page for Palantir requesting permission to access the Slack workspace." width=400> <br><br>

8. Send a test message, and watch it appear in the listener's output stream. <br><br>
   ![Slack test message.](/docs/resources/foundry/data-connection/listeners-slack-7.png) <br><br>
   ![Event shown in the test panel for the Slack listener in Data Connection.](/docs/resources/foundry/data-connection/listeners-slack-8.png) <br><br>

***

*All screenshots of Slack® are provided for reference purposes only and are the property of Slack Technologies, LLC.*
