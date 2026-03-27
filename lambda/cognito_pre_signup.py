def lambda_handler(event, context):
    del context

    response = event.setdefault("response", {})
    response["autoConfirmUser"] = True
    response["autoVerifyEmail"] = False
    response["autoVerifyPhone"] = False
    return event
