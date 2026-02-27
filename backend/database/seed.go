package database

import (
	"fmt"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

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

func seedGenreTags(db *gorm.DB) error {
	tags := []models.GenreTag{
		// 飲食
		{Name: "カフェ", Category: "飲食", Icon: "local_cafe"},
		{Name: "レストラン", Category: "飲食", Icon: "restaurant"},
		{Name: "ラーメン・麺類", Category: "飲食", Icon: "ramen_dining"},
		{Name: "居酒屋・バー", Category: "飲食", Icon: "sports_bar"},
		{Name: "スイーツ・ベーカリー", Category: "飲食", Icon: "bakery_dining"},
		// アウトドア
		{Name: "公園・緑地", Category: "アウトドア", Icon: "park"},
		{Name: "自然・ハイキング", Category: "アウトドア", Icon: "terrain"},
		{Name: "海・川・湖", Category: "アウトドア", Icon: "water"},
		// スポーツ
		{Name: "スポーツジム", Category: "スポーツ", Icon: "fitness_center"},
		{Name: "スポーツ施設", Category: "スポーツ", Icon: "directions_run"},
		// 文化・芸術
		{Name: "美術館・ギャラリー", Category: "文化・芸術", Icon: "palette"},
		{Name: "博物館・科学館", Category: "文化・芸術", Icon: "museum"},
		{Name: "図書館・書店", Category: "文化・芸術", Icon: "menu_book"},
		// エンタメ
		{Name: "映画館", Category: "エンタメ", Icon: "movie"},
		{Name: "カラオケ", Category: "エンタメ", Icon: "mic"},
		{Name: "ゲームセンター", Category: "エンタメ", Icon: "sports_esports"},
		// ショッピング
		{Name: "ショッピングモール", Category: "ショッピング", Icon: "shopping_bag"},
		{Name: "雑貨・セレクトショップ", Category: "ショッピング", Icon: "storefront"},
		// リラクゼーション
		{Name: "温泉・銭湯", Category: "リラクゼーション", Icon: "hot_tub"},
		{Name: "マッサージ・スパ", Category: "リラクゼーション", Icon: "spa"},
		// 観光・文化
		{Name: "神社・寺", Category: "観光・文化", Icon: "temple_buddhist"},
		{Name: "観光スポット", Category: "観光・文化", Icon: "photo_camera"},
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
			Name:          "コンフォートゾーン・ブレイカー",
			Description:   "脱却訪問を5件達成した",
			IconURL:       "",
			ConditionJSON: `{"type":"comfort_zone_break","threshold":5}`,
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
