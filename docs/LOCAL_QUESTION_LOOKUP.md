# 本機題庫唯讀查詢（尚未連到 ChatGPT）

以 Node 20.20.2 在專案根目錄執行。先準備已通過預檢的完整建置目錄，再由執行者固定指定該目錄。請不要把目錄路徑做成可由對話決定的參數。

    printf '%s\n' '{"op":"search","query":"假體","startYear":103,"endYear":103,"subject":"diagnostic-techniques","limit":2}' | node scripts/question-lookup.mjs /path/to/verified/dist
    printf '%s\n' '{"op":"fetch","id":"103-1-放射線診斷原理與技術學-067"}' | node scripts/question-lookup.mjs /path/to/verified/dist

查詢最多 3 個連續年份、12 筆結果；省略科目才跨科。分數只比較同次詞彙匹配。查找按官方連結與已核對轉錄範圍，只回傳題目識別、題幹、四個選項與來源頁碼、PDF 雜湊，附圖請看原卷。舊資料沒有該級別來源時，知道完整 ID 可核對身分，不提供題文，也不納入關鍵字搜尋。空結果不代表題庫沒有相關題目。回應中的索引與鍵表雜湊識別本機快照，不替代對完整建置的驗證。不讀作答、答案、詳解、手冊或教科書、不外查網路、不寫資料。

修正回報是不同的本機程序，僅將草稿輸出到 stdout，不寫題庫、沒有自動送出：

    printf '%s\n' '{"id":"103-1-放射線診斷原理與技術學-067","category":"question","description":"待人工核對"}' | node scripts/question-correction-draft.mjs /path/to/verified/dist

驗證：node --test tests/question-lookup.test.mjs。若未來要讓 ChatGPT 呼叫，僅把 search 與 fetch 接到經授權、具來源驗證且預先固定建置路徑的受控執行器；草稿功能不註冊為唯讀工具。真實課程聊天的查題、引用及回覆尚無端到端連線驗收。

後續驗收分開進行：在真實手機／平板／桌機固定視窗尺寸，從顯示首頁到能辨認「單元練習／整份試卷／錯題本」各入口，量到第一次找到入口的秒數（目標 5 秒），不把站點載入時間混入。另用合成官方新卷和更正批次測試自動匯入：只認官方來源與獨立版本、識別並不覆寫舊作答收據、未核證內容停在隔離，不與查詢或修正草稿共用寫入權限。
