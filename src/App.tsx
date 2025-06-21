import React, { useState } from "react";

const defaultForm = {
  // Name: "",
  // Phone: "",
  // Province: "",
  // City: "",
  // Area: "",
  // Address: "",
  // IDCard: "",

  Name: "焦国军",
  Phone: "17989892376",
  Province: "广东",
  City: "深圳市",
  Area: "宝安区",
  Address: "宝源二区 32巷1栋401",
  ProductID: "3a63e330af913423",
  IDCard: "340721199412256723",
  AgentID: "5879e81e899912ce",
};

const App: React.FC = () => {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ChUserName: "",
      ThirdPhone: "",
      NumberId: "",
      NumberPoolId: "",
      Name: form.Name,
      Phone: form.Phone,
      Province: form.Province,
      City: form.City,
      Area: form.Area,
      Address: form.Address,
      ProductID: "a3c10f9e0c4db741", // 移动 29 160G
      IDCard: form.IDCard,
      AgentID: "5879e81e899912ce",
      HeadImage: "",
      BackImage: "",
      FrontImage: "",
      ProSource: "",
    };
    const body = Object.keys(data)
      .map(
        (key) =>
          encodeURIComponent(key) + "=" + encodeURIComponent((data as any)[key])
      )
      .join("&");
    // const res = await fetch("/api/proxy", {
    const res = await fetch("/.netlify/functions/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
    });
    const text = await res.text();
    setResult(text);
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>免费领取表单</h2>
      <form onSubmit={handleSubmit}>
        姓名：
        <input name="Name" value={form.Name} onChange={handleChange} required />
        <br />
        手机号：
        <input
          name="Phone"
          value={form.Phone}
          onChange={handleChange}
          required
        />
        <br />
        省份：
        <input
          name="Province"
          value={form.Province}
          onChange={handleChange}
          required
        />
        <br />
        城市：
        <input name="City" value={form.City} onChange={handleChange} required />
        <br />
        区域：
        <input name="Area" value={form.Area} onChange={handleChange} required />
        <br />
        地址：
        <input
          name="Address"
          value={form.Address}
          onChange={handleChange}
          required
        />
        <br />
        身份证号：
        <input
          name="IDCard"
          value={form.IDCard}
          onChange={handleChange}
          required
        />
        <br />
        <button type="submit">提交</button>
      </form>
      <div style={{ marginTop: 20, wordBreak: "break-all" }}>
        <b>返回结果：</b>
        {result}
      </div>
    </div>
  );
};

export default App;
