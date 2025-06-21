import requests

url = "https://h5.lot-ml.com/H5OrderEn/Save"

headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://h5.lot-ml.com",
    "Referer": "https://h5.lot-ml.com/h5orderEn/index?pudID=3a63e330af913423&userid=5879e81e899912ce",
    "X-Requested-With": "XMLHttpRequest"
}

# 表单参数
payload = {
    "ChUserName": "",           # 可为空
    "ThirdPhone": "",           # 可为空
    "NumberId": "",             # 可为空
    "NumberPoolId": "",         # 可为空
    "Name": "焦国军",            # 必填
    "Phone": "17989892376",     # 必填
    "Province": "广东",          # 必填
    "City": "深圳市",            # 必填
    "Area": "宝安区",            # 必填
    "Address": "宝源二区 32巷1栋401", # 必填
    "ProductID": "3a63e330af913423", # 必填
    "IDCard": "340721199412256723",  # 必填
    "AgentID": "5879e81e899912ce",   # 必填
    "HeadImage": "",            # 可为空
    "BackImage": "",            # 可为空
    "FrontImage": "",           # 可为空
    "ProSource": ""             # 可为空
}

response = requests.post(url, headers=headers, data=payload)

print("状态码:", response.status_code)
print("返回内容:", response.text) 