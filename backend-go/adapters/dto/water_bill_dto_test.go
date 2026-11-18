package dto_test

import (
	"testing"

	"github.com/pobx/water-smart-bill/backend-go/adapters/dto"
)

func TestDTOConvertToEntityValidation(t *testing.T) {
	validDTO := &dto.CreateHomeownerDTO{
		FirstName: "สมชาย",
		LastName:  "สุขใจ",
		HouseNo:   "88/2",
	}
	entity, err := validDTO.ConvertToEntity()
	if err != nil {
		t.Fatalf("expected valid DTO conversion, got err=%v", err)
	}
	if entity.FirstName != "สมชาย" || entity.HouseNo != "88/2" {
		t.Fatalf("unexpected converted entity: %+v", entity)
	}

	invalidDTO := &dto.CreateHomeownerDTO{}
	if _, err := invalidDTO.ConvertToEntity(); err == nil {
		t.Fatalf("expected invalid DTO conversion to return validation error")
	}
}
