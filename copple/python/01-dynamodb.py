import boto3
# Get the service resource.
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')

table = dynamodb.Table('Event')
#쿼리
# response = table.get_item(
#     Key={
#         'UserId': 'arin0505',
#         'CreationTime': '13:00'
#     }
# )

# print(response)

# #아이템 삭제
# table.delete_item(Key={'UserId': 'eunjae0505',
#                        'CreationTime': '10:56'},)
# #아이템 정의
# item = {'UserId': 'west12', 'CreationTime': 'now'}

# table.put_item(Item=item)
#지정한 테이블 읽기
print(table.scan())