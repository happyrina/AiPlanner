# createitem.py

import boto3
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('users')
table.put_item(
   Item={
        'username': 'janedoe',
        'first_name': 'Jane',
        'last_name': 'Doe',
        'age': 25,
        'account_type': 'standard_user',
    }
)