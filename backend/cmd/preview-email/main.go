package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/Hiru-ge/roamble/services"
)

func main() {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	previews := map[string]func() (string, error){
		"streak_reminder.html": func() (string, error) {
			return svc.BuildStreakReminderEmail("ひるげ", 5)
		},
		"weekly_summary.html": func() (string, error) {
			return svc.BuildWeeklySummaryEmail(services.WeeklySummaryData{
				UserName:   "ひるげ",
				VisitCount: 7,
				TotalXP:    420,
				NewBadges:  services.BadgeItemsFromNames([]string{"最初の一歩", "カフェマスター"}),
			})
		},
		"weekly_summary_empty.html": func() (string, error) {
			return svc.BuildWeeklySummaryEmail(services.WeeklySummaryData{
				UserName:   "ひるげ",
				VisitCount: 0,
				TotalXP:    0,
			})
		},
		"monthly_summary.html": func() (string, error) {
			return svc.BuildMonthlySummaryEmail(services.MonthlySummaryData{
				UserName:   "ひるげ",
				VisitCount: 18,
				TotalXP:    1250,
				NewBadges:  services.BadgeItemsFromNames([]string{"最初の一歩", "エリアパイオニア", "ナイトウォーカー"}),
				Month:      "2026年3月",
			})
		},
		"monthly_summary_empty.html": func() (string, error) {
			return svc.BuildMonthlySummaryEmail(services.MonthlySummaryData{
				UserName:   "ひるげ",
				VisitCount: 0,
				TotalXP:    0,
				Month:      "2026年3月",
			})
		},
	}

	if err := os.MkdirAll("tmp/email-preview", 0755); err != nil {
		log.Fatalf("failed to create output directory: %v", err)
	}

	for name, fn := range previews {
		html, err := fn()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR %s: %v\n", name, err)
			continue
		}
		path := "tmp/email-preview/" + name
		if err := os.WriteFile(path, []byte(html), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR writing %s: %v\n", path, err)
		}
		fmt.Printf("wrote %s\n", path)
	}

	// インデックスページ生成
	index := `<!DOCTYPE html><html><head><title>Email Preview</title></head>
<body style="background:#111;color:#fff;font-family:sans-serif;padding:40px;">
<h1>Email Template Preview</h1><ul>
<li><a href="/preview/weekly_summary.html" style="color:#13ecec;">weekly_summary</a></li>
<li><a href="/preview/weekly_summary_empty.html" style="color:#13ecec;">weekly_summary_empty</a></li>
<li><a href="/preview/monthly_summary.html" style="color:#13ecec;">monthly_summary</a></li>
<li><a href="/preview/monthly_summary_empty.html" style="color:#13ecec;">monthly_summary_empty</a></li>
<li><a href="/preview/streak_reminder.html" style="color:#13ecec;">streak_reminder</a></li>
</ul></body></html>`
	if err := os.WriteFile("tmp/email-preview/index.html", []byte(index), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR writing index.html: %v\n", err)
	}

	// 静的ファイルサーバー
	http.Handle("/preview/", http.StripPrefix("/preview/", http.FileServer(http.Dir("tmp/email-preview"))))
	http.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("../frontend/public/assets"))))

	fmt.Println("\nServing at http://localhost:8088/preview/")
	log.Fatal(http.ListenAndServe(":8088", nil))
}
