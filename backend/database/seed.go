package database

import (
	"fmt"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

func seedGenreTags(db *gorm.DB) error {
	tags := []models.GenreTag{
		// 飲食
		{Name: "カフェ", Category: "飲食", Icon: "local_cafe"},
		{Name: "レストラン", Category: "飲食", Icon: "restaurant"},
		{Name: "ラーメン・麺類", Category: "飲食", Icon: "ramen_dining"},
		{Name: "居酒屋・バー", Category: "飲食", Icon: "sports_bar"},
		{Name: "スイーツ・ベーカリー", Category: "飲食", Icon: "bakery_dining"},
		// スポーツ
		{Name: "スポーツ施設", Category: "スポーツ", Icon: "directions_run"},
		// 文化
		{Name: "書店", Category: "文化", Icon: "menu_book"},
		// エンタメ
		{Name: "映画館", Category: "エンタメ", Icon: "movie"},
		{Name: "カラオケ", Category: "エンタメ", Icon: "mic"},
		{Name: "ゲームセンター", Category: "エンタメ", Icon: "sports_esports"},
		// ショッピング
		{Name: "雑貨・セレクトショップ", Category: "ショッピング", Icon: "storefront"},
		// リラクゼーション
		{Name: "温泉・銭湯", Category: "リラクゼーション", Icon: "hot_tub"},
		{Name: "マッサージ・スパ", Category: "リラクゼーション", Icon: "spa"},
		// プレミア（訪問履歴の表示専用。興味タグ選択・提案対象外）
		{Name: "プレミア", Category: "プレミア", Icon: "award_star"},
	}

	for _, tag := range tags {
		t := tag
		if err := db.Where(models.GenreTag{Name: t.Name}).
			Assign(models.GenreTag{
				Category: t.Category,
				Icon:     t.Icon,
			}).
			FirstOrCreate(&t).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedBadges(db *gorm.DB) error {
	badges := []models.Badge{
		{
			Name:          "最初の一歩",
			Description:   "初めての訪問を記録した",
			IconURL:       "",
			ConditionJSON: `{"type":"visit_count","threshold":1}`,
		},
		{
			Name:          "ジャンル開拓者",
			Description:   "チャレンジ訪問を5件達成した",
			IconURL:       "",
			ConditionJSON: `{"type":"breakout","threshold":5}`,
		},
		{
			Name:          "ジャンルコレクター Lv.1",
			Description:   "3種類のジャンルを訪問した",
			IconURL:       "",
			ConditionJSON: `{"type":"genre_count","threshold":3}`,
		},
		{
			Name:          "ジャンルコレクター Lv.2",
			Description:   "5種類のジャンルを訪問した",
			IconURL:       "",
			ConditionJSON: `{"type":"genre_count","threshold":5}`,
		},
		{
			Name:          "ジャンルコレクター Lv.3",
			Description:   "10種類のジャンルを訪問した",
			IconURL:       "",
			ConditionJSON: `{"type":"genre_count","threshold":10}`,
		},
		{
			Name:          "ストリークマスター Lv.1",
			Description:   "4週連続でストリークを達成した",
			IconURL:       "",
			ConditionJSON: `{"type":"streak_weeks","threshold":4}`,
		},
		{
			Name:          "ストリークマスター Lv.2",
			Description:   "12週連続でストリークを達成した",
			IconURL:       "",
			ConditionJSON: `{"type":"streak_weeks","threshold":12}`,
		},
		{
			Name:          "ストリークマスター Lv.3",
			Description:   "24週連続でストリークを達成した",
			IconURL:       "",
			ConditionJSON: `{"type":"streak_weeks","threshold":24}`,
		},
		{
			Name:          "エリアパイオニア",
			Description:   "かつて訪れた場所から10km以上離れた新しいエリアを冒険した",
			IconURL:       "",
			ConditionJSON: `{"type":"new_area","threshold":1}`,
		},
		{
			Name:          "ナイトウォーカー",
			Description:   "深夜（23:00〜翌5:00）に訪問を記録した",
			IconURL:       "",
			ConditionJSON: `{"type":"night_visit","threshold":1}`,
		},
		{
			Name:          "ウィークエンドウォリアー",
			Description:   "週末に3箇所以上訪問した",
			IconURL:       "",
			ConditionJSON: `{"type":"weekend_visits","threshold":3}`,
		},
	}

	for _, badge := range badges {
		b := badge
		if err := db.Where(models.Badge{Name: b.Name}).
			Assign(models.Badge{
				Description:   b.Description,
				IconURL:       b.IconURL,
				ConditionJSON: b.ConditionJSON,
			}).
			FirstOrCreate(&b).Error; err != nil {
			return err
		}
	}
	return nil
}

// SeedMasterData inserts initial master data (idempotent)
func SeedMasterData(db *gorm.DB) error {
	if err := seedGenreTags(db); err != nil {
		return fmt.Errorf("failed to seed genre_tags: %w", err)
	}
	if err := seedBadges(db); err != nil {
		return fmt.Errorf("failed to seed badges: %w", err)
	}
	return nil
}
