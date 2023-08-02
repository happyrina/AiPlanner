import os
import sys
from boto3 import client

polly = client("polly", region_name="ap-northeast-2")
response = polly.synthesize_speech(
        Text="아린아 모해? 나는 민희야. 스쿼트민희.",
        OutputFormat="mp3",
        VoiceId="Seoyeon")

stream = response.get("AudioStream")

with open('aws_test_tts.mp3', 'wb') as f:
    data = stream.read()
    f.write(data)