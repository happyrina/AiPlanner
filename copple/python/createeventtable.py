import boto3

# Create a DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')  # Change the region as needed

# Define the table attributes and key schema
table_name = 'Event'
table = dynamodb.create_table(
    TableName=table_name,
    KeySchema=[
        {
            'AttributeName': 'EventId',
            'KeyType': 'HASH'  # Partition key
        }
    ],
    AttributeDefinitions=[
        {
            'AttributeName': 'EventId',
            'AttributeType': 'S'  # String data type
        }
    ],
    ProvisionedThroughput={
        'ReadCapacityUnits': 5,   # Adjust as needed
        'WriteCapacityUnits': 5   # Adjust as needed
    }
)

# Wait for the table to be created
table.meta.client.get_waiter('table_exists').wait(TableName=table_name)

# Print table details
print("Table status:", table.table_status)
