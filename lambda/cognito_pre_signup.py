def lambda_handler(event, context):
    del context

    user_attributes = event.get("request", {}).get("userAttributes", {})
    response = event.setdefault("response", {})
    response["autoConfirmUser"] = True
    response["autoVerifyEmail"] = bool(user_attributes.get("email"))
    response["autoVerifyPhone"] = False
    return event
