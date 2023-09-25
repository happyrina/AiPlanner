import boto3

# Initialize the DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')
# Define the table name
table_name = 'Account'

# Get the DynamoDB table
table = dynamodb.Table(table_name)

# Define the item data
item_data = {
    'UserId': 'user123',
    'UserName': 'JohnDoe',
    'Passwd': 'securepassword123'
}

# Put the item in the table
table.put_item(Item=item_data)

print("Item added successfully.")