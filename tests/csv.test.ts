import { describe, expect, test } from "bun:test"
import { parseCredentialCsv, parseCsv } from "../src/utils/csv"

describe("parseCsv", () => {
  test("表头转小写并 trim，值保持原样", () => {
    const { keys, records } = parseCsv("Name, URL ,Username\nfoo, https://a.com ,bar\n")
    expect(keys).toEqual(["name", "url", "username"])
    expect(records).toEqual([{ name: "foo", url: " https://a.com ", username: "bar" }])
  })

  test("支持引号包裹、逗号、转义引号与字段内换行", () => {
    const text = 'a,b\n"x,y","say ""hi"""\n"line1\nline2",z\n'
    const { records } = parseCsv(text)
    expect(records[0]).toEqual({ a: "x,y", b: 'say "hi"' })
    expect(records[1]).toEqual({ a: "line1\nline2", b: "z" })
  })

  test("兼容 BOM 与 CRLF，跳过空白行", () => {
    const { records } = parseCsv("\uFEFFa,b\r\n1,2\r\n\r\n  \r\n3,4\r\n")
    expect(records).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ])
  })

  test("空文本返回空结果", () => {
    expect(parseCsv("")).toEqual({ keys: [], records: [] })
  })
})

describe("parseCredentialCsv", () => {
  const chromeCsv =
    "\uFEFFname,url,username,password,note\r\n" +
    'example.com,"https://admin.example.com/login",admin,"p@ss,word",\r\n' +
    'example.com,https://a.example.com,admin,"say ""hi""",备注\r\n' +
    'example.com,https://b.example.com,admin,"line1\nline2",\r\n'

  test("Chrome 导出：逗号密码、转义引号、字段内换行都不丢", () => {
    expect(parseCredentialCsv(chromeCsv)).toEqual([
      { url: "https://admin.example.com/login", username: "admin", password: "p@ss,word" },
      { url: "https://a.example.com", username: "admin", password: 'say "hi"' },
      { url: "https://b.example.com", username: "admin", password: "line1\nline2" },
    ])
  })

  test("Firefox 导出：全字段带引号", () => {
    const csv =
      '"url","username","password","httpRealm","formActionOrigin","guid"\n' +
      '"https://app.example.com","ff-user","ff-pass","","https://app.example.com","{guid}"\n'
    expect(parseCredentialCsv(csv)).toEqual([
      { url: "https://app.example.com", username: "ff-user", password: "ff-pass" },
    ])
  })

  test("Bitwarden 导出：login_* 表头", () => {
    const csv =
      "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,totp\n" +
      "prod,0,login,生产管理员,说明,,,https://admin.example.com,admin@example.com,bw-pass,\n"
    expect(parseCredentialCsv(csv)).toEqual([
      { url: "https://admin.example.com", username: "admin@example.com", password: "bw-pass" },
    ])
  })

  test("密码首尾空格必须原样保留", () => {
    const csv = "url,username,password\nhttps://a.com,u,\"  padded  \"\n"
    expect(parseCredentialCsv(csv)[0]?.password).toBe("  padded  ")
  })

  test("缺表头 / 缺 url / 缺账号的行被丢弃", () => {
    expect(parseCredentialCsv("a,b\n1,2\n")).toEqual([])
    expect(parseCredentialCsv("url,username,password\n,u,p\n")).toEqual([])
    expect(parseCredentialCsv("url,username,password\nhttps://a.com,,p\n")).toEqual([])
    expect(parseCredentialCsv("")).toEqual([])
  })
})
