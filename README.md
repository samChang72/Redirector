## 描述
網頁瀏覽器擴充功能（Firefox, Vivaldi, Chrome, Opera, Edge），可根據正規表達式 (Regex) 或萬用字元 (Wildcard) 模式重新導向 URL。

**版本 4.0.0** - 現已支援 Chrome Manifest V3！這次重大更新帶來了與最新 Chrome 擴充功能標準的相容性，同時保留了所有現有功能。

## 致敬
懷念 Einar Egilsson，他創造了 Redirector 並無私地維護了多年。Einar，我們想念你，並將永遠銘記你的善良與慷慨。

## 4.0.0 新功能
- ✅ **支援 Chrome Manifest V3** - 與最新的 Chrome 擴充功能架構完全相容
- ✅ **Service Worker 遷移** - 背景腳本已轉換為 Service Worker 以提升效能
- ✅ **declarativeNetRequest API** - 從 webRequest 更新為新的 declarativeNetRequest API
- ✅ **增強安全性** - 改進了權限模型，使用 host_permissions
- ✅ **保持相容性** - 所有現有的重新導向規則將繼續無縫運作
- ✅ **跨瀏覽器支援** - 依然適用於 Firefox, Chrome, Edge, Opera 和 Vivaldi

## 下載連結
* [Firefox](https://addons.mozilla.org/firefox/addon/redirector/)
* [Google Chrome 和 Vivaldi](https://chrome.google.com/webstore/detail/redirector/ocgpenflpmgnfapjedencafcfakcekcd)
<!--
Opera extension is no longer present (as of 2023/01/16)
* [Opera](https://addons.opera.com/extensions/details/redirector-2/)
-->

## 4.0.0 技術說明

### Chrome Manifest V3 遷移
此版本引入了對 Chrome Manifest V3 的支援，帶來了幾項架構變更：

- **Service Worker**：背景腳本現在作為 Service Worker 執行，而不是持久的背景頁面
- **declarativeNetRequest**：重新導向現在使用 Chrome 的 declarativeNetRequest API 處理，而不是 webRequest
- **增強權限**：更細緻的權限系統，具有明確的主機權限
- **改進安全性**：更好的隔離和安全模型

### 相容性
- **Chrome/Chromium 瀏覽器**：需要 Chrome 88+ 才能完全支援 Manifest V3
- **Firefox**：繼續使用現有的 WebExtensions API 運作
- **舊版支援**：3.x 版本仍可用於舊版瀏覽器

### 從 3.x 遷移
- 所有現有的重新導向規則將自動遷移
- 更新過程中無需使用者操作
- 設定和偏好設定將被保留

## 範例
### 去除行動版網頁 (De-mobilizer)
- 範例 URL：`https://en.m.wikipedia.org/`
- 包含模式：`^(https?://)([a-z0-9-]*\.)m(?:obile)?\.(.*)`
- 重新導向至：`$1$2$3`
- 模式類型：正規表達式 (Regular Expression)
- 描述：總是顯示網頁的桌面版本

### AMP 重新導向
- 範例 URL：`https://www.google.com/amp/www.example.com/amp/document`
- 包含模式：`^(?:https?://)www.(?:google|bing).com/amp/(?:s/)?(.*)`
- 重新導向至：`https://$1`
- 模式類型：正規表達式 (Regular Expression)
- 描述：AMP 不好：<https://80x24.net/post/the-problem-with-amp/>

### Doubleclick 規避
- 範例 URL：`https://ad.doubleclick.net/ddm/trackclk/N135005.2681608PRIVATENETWORK/B20244?https://www.example.com`
- 包含模式：`^(?:https?://)ad.doubleclick.net/.*\?(http?s://.*)`
- 重新導向至：`$1`
- 模式類型：正規表達式 (Regular Expression)
- 描述：移除 Doubleclick 連結追蹤 / 修復基於主機阻擋 Doubleclick 的問題

### YouTube Shorts 轉一般 YouTube
- 範例 URL：`https://www.youtube.com/shorts/video-id`
- 包含模式：`^(?:https?://)(?:www.)?youtube.com/shorts/([a-zA-Z0-9_-]+)(.*)`
- 重新導向至：`https://www.youtube.com/watch?v=$1$2`
- 模式類型：正規表達式 (Regular Expression)
- 描述：將 YouTube Shorts 重新導向至一般 YouTube 頁面

### !bangs 樂趣
什麼是 bangs？：<https://duckduckgo.com/bangs>

#### 在 Google 上使用 DuckDuckGo.com !bangs
- 範例 URL：`https://www.google.com/search?&ei=-FvkXcOVMo6RRwW5p5DgBg&q=asdfasdf%21+sadfas&oq=%21asdfasdf+sadfas&gs_l=asdfsadfafsgaf`
- 包含模式：`^(?:https?://)(?:www.)google\.(?:com|au|de|co\.uk)/search\?(?:.*)?(?:oq|q)=([^\&]*\+)?((?:%21|!)[^\&]*)`
- 重新導向至：`https://duckduckgo.com/?q=$1$2`
- 模式類型：正規表達式 (Regular Expression)
- 描述：將任何帶有 !bang 的 Google 查詢重新導向至 DDG

### 自訂 DuckDuckGo.com !bangs

#### DDG !example 基礎
- 範例 URL：`https://duckduckgo.com/?q=!`__example__`&get=other`
- 包含模式：`^(?:https?://)(?:.*\.)?duckduckgo.com/\?q=(?:%21|!)`__example__`(?=[^\+]|$)(?=\W|$)`
- 重新導向至：`https://example.com/`
- 模式類型：正規表達式 (Regular Expression)
- 描述：當 !bang 是唯一的搜尋參數時，重新導向至基礎網站

#### DDG !example 搜尋
- 範例 URL：`https://duckduckgo.com/?q=searchterm+!`__example__`+searchterm2&get=other`
- 包含模式：`^(?:https?://)(?:.*\.)?duckduckgo.com/\?q=(.*\+)?(?:(?:%21|!)`__example__`)(?:\+([^\&\?\#]*))?(?:\W|$)`
- 重新導向至：`https://example.com/?query=$1$2`
- 模式類型：正規表達式 (Regular Expression)
- 描述：重新導向至自訂網站搜尋

#### DDG !ghh git-history
- 範例 URL：`https://duckduckgo.com/?q=!ghh+https%3A%2F%2Fgithub.com%2Fbabel%2Fbabel%2Fblob%2Fmaster%2Fpackages%2Fbabel-core%2FREADME.md&adfasfasd`
- 包含模式：`^(?:https?://)duckduckgo.com/\?q=(?:(?:%21|!)ghh\+)(?:.*)(github|gitlab|bitbucket)(?:\.org|\.com)(.*?(?=\&))`
- 重新導向至：`https://$1.githistory.xyz$2`
- 模式類型：正規表達式 (Regular Expression)
- 描述：建立新的 !ghh bang 以重新導向至 <https://githistory.xyz>
- 進階：
    - 處理符合項目：URL 解碼
    
### 快速 DuckDuckGo.com !bangs

直接前往常用的 DuckDuckGo bangs 以避免中間的網路請求。

- 範例 URL：`https://duckduckgo.com/?q=foo+bar+%21google+test+bar`
- 包含模式：`^https://duckduckgo\.com/\?q=(.*)\+(?:%21|!)google\b\+(.*?)(?:&|$)`
- 重新導向至：`https://google.com/search?hl=en&q=$1+$2`
- 模式類型：正規表達式 (Regular Expression)
- 描述：DuckDuckGo → Google !bang 捷徑（前綴和後綴）
- 模式描述：使用兩個分開的模式以避免 URL 中出現多餘的 +
###
  
- 範例 URL：`https://duckduckgo.com/?q=foo+bar+%21google`
- 包含模式：`^https://duckduckgo\.com/\?q=(.*?)\+?(?:%21|!)google\b\+?(.*?)(?:&|$)`
- 重新導向至：`https://google.com/search?hl=en&q=$1$2`
- 模式類型：正規表達式 (Regular Expression)
- 描述：DuckDuckGo → Google !bang 捷徑（前綴或後綴）
- 模式描述：使用兩個分開的模式以避免 URL 中出現多餘的 +

## 深色主題
如果您是 Firefox 使用者並使用深色主題，您可以將這些行新增至您的 `userChrome.css` 檔案，以使 Redirector 的擴充功能按鈕更顯眼：

```css
/* Redirector button for dark Firefox themes */
toolbarbutton#toggle-button--redirectoreinaregilssoncom-redirector[image*="active"] { filter: invert(1) brightness(6); }
toolbarbutton#toggle-button--redirectoreinaregilssoncom-redirector[image*="disabled"] { filter: invert(1) brightness(2.5); }
```

如果您不知道 `userChrome.css` 檔案是什麼，或如何編輯它，請在 Firefox 論壇上查詢，而不是在本儲存庫中詢問。謝謝！
