// Individually sourced revisions; scopes distinguish medical definitions from grading-only reviews.
export default {
  "100-2-放射線治療原理與技術學-080": {
    "revision": "tg43-source-check-20261113",
    "checkedAt": "2026-11-13",
    "status": "source-checked",
    "reviewedBy": "AI source cross-check; not expert approval",
    "scope": "術語與公式符號；100 年官方原卷／答案尚無直接來源對照",
    "explanation": {
      "testedConcept": "TG-43 二維劑量率公式的 F(r,θ)。",
      "background": "公式將源強度、幾何、徑向衰減與角度差異分開。Λ 是劑量率常數；G 是幾何函數；g 是徑向劑量函數。",
      "reasoningSteps": [
        "確認題目問 F(r,θ)。",
        "報告將它定義為二維各向異性函數，因此對應 D；保留題目選項的 anisotropic factor 用字。"
      ],
      "optionAnalysis": {
        "A": "表觀活度不是 Λ；Λ 是劑量率常數。",
        "B": "幾何函數是 G，不是 g。",
        "C": "徑向劑量函數是 g(r)。",
        "D": "F(r,θ) 描述相對橫向平面的角度變化。"
      },
      "confusingConcepts": "大寫 G 與小寫 g 不可互換；二維 F(r,θ) 也不可與一維各向異性函數混同。",
      "sourceCitation": "AAPM TG-43U1，Medical Physics 31 (2004)，§III.A.1–5；公式 (1)、(3)、(6)、(8)",
      "sourcePage": "637–639（PDF 第 5–7 頁）",
      "sourceUrl": "https://www.aapm.org/meetings/04AM/pdf/14-2226-27835.pdf#page=5"
    },
    "sourcedTags": [
      {
        "label": "放射治療劑量計算",
        "source": "https://www.aapm.org/meetings/04AM/pdf/14-2226-27835.pdf#page=5",
        "page": "637–639",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      },
      {
        "label": "TG-43 與近接治療",
        "source": "https://www.aapm.org/meetings/04AM/pdf/14-2226-27835.pdf#page=5",
        "page": "637–639",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      }
    ],
    "questionSignature": "[\"在AAPM TG-43號報告中，關於 (r,θ) = Λ g(r) F(r,θ) ，其中F(r,θ)所指為\\nSk[G(r,θ)/G(1,π/2)]\\n何？\",[[\"A\",\"apparent activity\"],[\"B\",\"geometry factor\"],[\"C\",\"radial dose function\"],[\"D\",\"anisotropic factor\"]]]"
  },
  "115-1-醫學物理學與輻射安全-011": {
    "revision": "effective-ssd-source-check-20261113",
    "checkedAt": "2026-11-13",
    "status": "source-checked",
    "reviewedBy": "AI source cross-check; not expert approval",
    "scope": "官方圖形、有效 SSD 修正式與代入算術；尚非專家審核",
    "sourceProvenance": {
      "questionUrl": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115020&c=309&s=0601&q=1",
      "questionSha256": "d0b5e2fc5e88f3e5bdda2454b8dc678708ee26ae416dcefee54c80e32252d836",
      "questionPage": 2,
      "questionPages": [
        2,
        3
      ],
      "images": [
        {
          "path": "/uploads/115-1-醫學物理學與輻射安全-011-1.png",
          "sourcePdfSha256": "d0b5e2fc5e88f3e5bdda2454b8dc678708ee26ae416dcefee54c80e32252d836",
          "sourceUrl": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115020&c=309&s=0601&q=1",
          "page": 3,
          "xref": 4,
          "pixelEqual": true,
          "width": 297,
          "height": 102,
          "sha256": "b7a6c78069ac8c8154438ae6a6e9406c8599a670aef1bc2880ce7039608999e8"
        },
        {
          "path": "/uploads/115-1-醫學物理學與輻射安全-011-2.png",
          "sourcePdfSha256": "d0b5e2fc5e88f3e5bdda2454b8dc678708ee26ae416dcefee54c80e32252d836",
          "sourceUrl": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115020&c=309&s=0601&q=1",
          "page": 3,
          "xref": 5,
          "pixelEqual": true,
          "width": 297,
          "height": 102,
          "sha256": "182ad501d5ad5b5febccb1b2af8ee8563f448084447c615d8ea2760fe56d7d1b"
        },
        {
          "path": "/uploads/115-1-醫學物理學與輻射安全-011-3.png",
          "sourcePdfSha256": "d0b5e2fc5e88f3e5bdda2454b8dc678708ee26ae416dcefee54c80e32252d836",
          "sourceUrl": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115020&c=309&s=0601&q=1",
          "page": 3,
          "xref": 6,
          "pixelEqual": true,
          "width": 297,
          "height": 102,
          "sha256": "01a911dab286162cec5456be6e2614591db75fc5473e9be3d50cd6e5a21c9b34"
        }
      ]
    },
    "explanation": {
      "testedConcept": "有效 SSD 法的體表不規則校正。",
      "background": "圖中 A 上方相對參考平面缺少厚度 h 的組織；劑量仍歸一於中央軸最大劑量點。IAEA 公式 (6.66) 使用 dmax 修正此參考關係。",
      "reasoningSteps": [
        "PDD校正 = PDD原 × [(SSD + dmax) / (SSD + h + dmax)]²。",
        "代入：82.5 × (101.5 / 104.5)² = 77.831…，四捨五入為 77.8，選 C。",
        "d = 6 cm 用來指定題目所給的 PDD；本修正因子不另乘一次以 d 為基礎的逆平方項。"
      ],
      "optionAnalysis": {
        "A": "63.5 不符合上述公式代入。",
        "B": "69.4 不符合上述公式代入。",
        "C": "77.8 與計算結果一致。",
        "D": "87.4 不是本題歸一方式下的結果。"
      },
      "confusingConcepts": "缺失組織 h 的符號、PDD 的歸一點與計算深度不同。舊詳解混用 d±h 並重複修正，已封存。",
      "sourceCitation": "IAEA Radiation Oncology Physics (2005)，§6.11.1.1，圖 6.19、公式 (6.66)",
      "sourcePage": "201–202（PDF 第 239–240 頁）",
      "sourceUrl": "https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1196_web.pdf#page=239"
    },
    "sourcedTags": [
      {
        "label": "放射治療劑量計算",
        "source": "https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1196_web.pdf#page=239",
        "page": "201–202",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      },
      {
        "label": "PDD 與有效 SSD",
        "source": "https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1196_web.pdf#page=239",
        "page": "201–202",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      }
    ],
    "questionSignature": "[\"如圖所示，若有一放射治療射束進入一不規則體表S，dmax為最大劑量深度，A 點的深度為d，若SSD=100\\ncm，dmax=1.5 cm，h=3 cm，d=6 cm，A 點所在深度的百分深度劑量（PDD）為82.5，則校正後A 點的PDD 約為\\n多少？\\n{{image:assets/115-1-醫學物理學與輻射安全-011-1.png}}\\n{{image:assets/115-1-醫學物理學與輻射安全-011-2.png}}\\n{{image:assets/115-1-醫學物理學與輻射安全-011-3.png}}\",[[\"A\",\"63.5\"],[\"B\",\"69.4\"],[\"C\",\"77.8\"],[\"D\",\"87.4\"]]]"
  },
  "114-1-放射線診斷原理與技術學-036": {
    "revision": "moex-114020-4309-q36-grading-review-20261113",
    "checkedAt": "2026-11-13",
    "status": "source-checked",
    "reviewedBy": "AI source cross-check; not expert approval",
    "scope": "只核對官方給分規則與選項排序差異；醫學解釋未完成查核",
    "explanation": {
      "testedConcept": "CT影像HU排序題，以及本題官方更正的給分範圍。",
      "background": "官方答案更正表可以證明哪些答案給分，不能單憑雙答案推論兩種組織排序在醫學上等價。",
      "reasoningSteps": [
        "原答案格第36題標示 #，必須閱讀備註。",
        "備註明示答B或C者均給分。",
        "依原文接受單選B或單選C；沒有將BC組合或其他答案列為給分。"
      ],
      "optionAnalysis": {
        "A": "不在官方列出的給分答案中。",
        "B": "官方備註列為給分答案。",
        "C": "官方備註列為給分答案；其①②排序與B不同，不能說兩者排列相同。",
        "D": "不在官方列出的給分答案中。"
      },
      "confusingConcepts": "給分規則與醫學推論分開：舊詳解推測官方接受C的理由，缺少來源支持，因此不沿用為結論。",
      "sourceCitation": "考選部114年第一次醫事放射師，診斷學（4309）測驗題標準答案更正，第36題備註",
      "sourcePage": "1",
      "sourceUrl": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=M&code=114020&c=309&s=0603&q=1#page=1"
    },
    "sourcedTags": [],
    "questionSignature": "[\"腦組織電腦斷層影像CT的HU（Hounsfield unit），由高至低的順序下列何者正確？①白質 ②灰\\n質 ③血塊 ④骨頭\",[[\"A\",\"①②③④\"],[\"B\",\"④③②①\"],[\"C\",\"④③①②\"],[\"D\",\"④①③②\"]]]"
  },
  "114-2-放射線器材學（包括磁振學與超音波學）-013": {
    "revision": "ct-noise-source-check-20261113",
    "checkedAt": "2026-11-13",
    "status": "source-checked",
    "reviewedBy": "AI source cross-check; not expert approval",
    "scope": "官方3×3矩陣轉錄、ROI雜訊定義與算術比較；非臨床品保合格判定",
    "explanation": {
      "testedConcept": "用 ROI 內像素值的標準差比較 CT 雜訊。",
      "background": "把四個九宮格想成四把平衡的翹翹板：中心同樣在零，但某一格出現正負成對的大數，並不會讓平均值升高。要找最吵的那一格，要看數字離零有多遠，而不是只看正負抵銷後剩多少。",
      "reasoningSteps": [
        "依官方原圖讀出四組數值；四組總和皆為 0，所以平均皆為 0。",
        "比較離均差平方和：A=8、B=14、C=24、D=38。各組樣本數相同，標準差大小依序為 D>C>B>A。",
        "D 的分散程度最大，符合官方答案 D。"
      ],
      "optionAnalysis": {
        "A": "平方和 8，四者最小。",
        "B": "平方和 14，大於 A，仍小於 C、D。",
        "C": "平方和 24，小於 D。",
        "D": "平方和 38，四者最大。"
      },
      "confusingConcepts": "平均值相同不代表雜訊相同。本題使用9個像素作比較；不能把這個小矩陣當成實際CT品保ROI大小規範。以 n 或 n−1 作分母都不改變本題排序。",
      "sourceCitation": "IAEA Handbook of Basic Quality Control Tests for Diagnostic Radiology，Human Health Series No.47，§5.2.1.4(d)；矩陣及答案另對照考選部114090/3309",
      "sourcePage": "139（PDF 第149頁）；官方試題第4頁、答案第1頁",
      "sourceUrl": "https://www-pub.iaea.org/MTCD/publications/PDF/PUB2021_web.pdf#page=149"
    },
    "sourcedTags": [
      {
        "label": "醫學影像假體",
        "source": "https://www-pub.iaea.org/MTCD/publications/PDF/PUB2021_web.pdf#page=149",
        "page": "139",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      },
      {
        "label": "CT 雜訊與標準差",
        "source": "https://www-pub.iaea.org/MTCD/publications/PDF/PUB2021_web.pdf#page=149",
        "page": "139",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      }
    ],
    "questionSignature": "[\"假設下列選項是一個圈選 3×3 畫素 ROI 的水假體 CT 影像，下列何者之影像雜訊最大？\",[[\"A\",\"{{image:/uploads/official-114090-3309-q013-A.jpeg}}\"],[\"B\",\"{{image:/uploads/official-114090-3309-q013-B.jpeg}}\"],[\"C\",\"{{image:/uploads/official-114090-3309-q013-C.jpeg}}\"],[\"D\",\"{{image:/uploads/official-114090-3309-q013-D.jpeg}}\"]]]"
  },
  "103-1-放射線診斷原理與技術學-067": {
    "revision": "ct-phantom-source-check-20261113",
    "checkedAt": "2026-11-13",
    "status": "source-checked",
    "reviewedBy": "AI source cross-check; not expert approval",
    "scope": "官方原圖與答案；IAEA 雜訊、均勻度定義；不包含掃描儀合格判定",
    "questionSignature": "[\"下圖是CT影像品質的測試假體的影像。請問這張影像可以測得那些影像品質？①對比解析度 ②雜訊 ③影像均勻度\\n{{image:/uploads/official-103020-4308-q067.jpeg}}\",[[\"A\",\"僅①②\"],[\"B\",\"僅①②③\"],[\"C\",\"僅①③\"],[\"D\",\"僅②③\"]]]",
    "explanation": {
      "testedConcept": "均質 CT 假體可用來檢查的影像品質項目。",
      "background": "先把圖中的圓盤想成一整塊材質相同的樣本。若同一小塊內的數值忽高忽低，先看這一塊的波動；若每塊內都很平穩，卻出現中心整塊比邊緣偏高的情形，就要查位置造成的差別。",
      "reasoningSteps": [
        "原圖呈現均質圓形假體，沒有用來比較不同對比目標的可辨識插入物。這是依本題圖形作的判讀。",
        "把上述兩種現象拆開：一小塊內的波動對應②，換到不同位置後整塊的偏移對應③，因此選 D。",
        "另以官方原答案及更正清單核對：第67題答案 D，清單註明無更正紀錄。"
      ],
      "optionAnalysis": {
        "A": "①②包含本圖未呈現的對比解析度測試目標，且漏掉③。",
        "B": "①②③多包含①，與官方答案不符。",
        "C": "①③包含①，且漏掉②。",
        "D": "②③對應雜訊與均勻度，符合官方答案。"
      },
      "confusingConcepts": "記成「同一塊亂不亂」和「換一塊會不會整體變高或變低」。題圖可用來辨認適合測什麼，沒有原始像素數值就不能報出測量結果，也不能據此判合格。",
      "sourceCitation": "IAEA Handbook of Basic Quality Control Tests for Diagnostic Radiology, HHS 47, §5.2.1.4(d)–(e)；考選部103020/4308第67題",
      "sourcePage": "139（PDF第149頁）；官方試題第12頁、答案第1頁、更正清單第7頁",
      "sourceUrl": "https://www-pub.iaea.org/MTCD/publications/PDF/PUB2021_web.pdf#page=149"
    },
    "sourcedTags": [
      {
        "label": "醫學影像假體",
        "source": "https://www-pub.iaea.org/MTCD/publications/PDF/PUB2021_web.pdf#page=149",
        "page": "139",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      },
      {
        "label": "CT 雜訊與標準差",
        "source": "https://www-pub.iaea.org/MTCD/publications/PDF/PUB2021_web.pdf#page=149",
        "page": "139",
        "status": "source-aligned",
        "reviewedBy": "AI source cross-check; not expert approval"
      }
    ]
  }
}
