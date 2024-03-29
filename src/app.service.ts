import { Injectable } from "@nestjs/common";
import {
  GetClientsCountRequestDto,
  GetPromotionsRankingRequestDto,
} from "./analytics.dto";
import {
  GetAffluenceRequest,
  GetAffluenceResponse,
  GetClientsCountResponse,
  GetPromotionCheckoutsCountRequest,
  GetPromotionCheckoutsCountResponse,
  GetPromotionsRankingResponse,
} from "./analytics.pb";
import { Balance } from "./balance/balance.entity";
import { PromotionService } from "./promotion/promotion.service";
import { ShopService } from "./shop/shop.service";
import { Transaction } from "./transaction/transaction.entity";

@Injectable()
export class AppService {
  constructor(
    private readonly shopService: ShopService,
    private readonly promotionService: PromotionService
  ) {}

  async getAffluence(
    payload: GetAffluenceRequest
  ): Promise<GetAffluenceResponse> {
    try {
      const { shopId, startDate, endDate } = payload;

      if (!shopId || !startDate || !endDate) {
        return {
          status: 400,
          value: null,
          errors: ["Missing parameters"],
        } as GetAffluenceResponse;
      }

      if (!this.checkIsoDate(startDate) || !this.checkIsoDate(endDate)) {
        return {
          status: 500,
          value: null,
          errors: ["Invalid date format"],
        } as GetAffluenceResponse;
      }

      const shop = await this.shopService.findOne(shopId);

      if (!shop) {
        return {
          status: 404,
          value: null,
          errors: ["Shop not found"],
        } as GetAffluenceResponse;
      }

      if (
        !shop.promotions ||
        shop.promotions.length === 0 ||
        !shop.cards ||
        shop.cards.length === 0
      ) {
        return {
          status: 200,
          value: 0,
          errors: [],
        } as GetAffluenceResponse;
      }

      let transactions: Transaction[] = [];
      for (const promotion of shop.promotions)
        for (const balance of promotion.balances)
          transactions = [...transactions, ...balance.transactions];

      // filter transactions by period
      let filteredTransactions: Transaction[] = transactions.filter(
        (transaction) => {
          return (
            transaction.createdAt.toISOString()?.split("T")?.[0] >=
              payload.startDate &&
            transaction.createdAt.toISOString()?.split("T")?.[0] <=
              payload.endDate
          );
        }
      );

      return {
        status: 200,
        value: filteredTransactions.length,
        errors: [],
      } as GetAffluenceResponse;
    } catch (error) {
      return {
        status: 500,
        value: null,
        errors: [error],
      } as GetAffluenceResponse;
    }
  }

  /**
   * getCountBalanceByPromotionId
   * @param shopId
   * @param promotionId
   * @param period
   * @returns
   */
  async getPromotionCheckoutsCount(
    payload: GetPromotionCheckoutsCountRequest
  ): Promise<GetPromotionCheckoutsCountResponse> {
    try {
      const { shopId, promotionId, startDate, endDate } = payload;

      if (!shopId || !promotionId || !startDate || !endDate) {
        return {
          status: 400,
          value: null,
          errors: ["Missing parameters"],
        } as GetPromotionCheckoutsCountResponse;
      }

      const promotion = await this.promotionService.findOneFromShop(
        promotionId,
        shopId
      );

      if (!promotion) {
        return {
          status: 200,
          value: 0,
          errors: [],
        } as GetPromotionCheckoutsCountResponse;
      }

      const balances = promotion.balances;

      let filteredBalances = [];
      filteredBalances = balances.filter((balance) => {
        return (
          balance.createdAt.toISOString()?.split("T")?.[0] >=
            payload.startDate &&
          balance.createdAt.toISOString()?.split("T")?.[0] <= payload.endDate
        );
      });

      // sum counter in balances (number)
      const count: number = filteredBalances.reduce((acc, balance) => {
        return acc + balance.counter;
      }, 0);

      return {
        status: 200,
        value: count,
        errors: [],
      } as GetPromotionCheckoutsCountResponse;
    } catch (error) {
      return {
        status: 500,
        value: null,
        errors: [error],
      } as GetPromotionCheckoutsCountResponse;
    }
  }

  /**
   * getBestPromotion
   * @param shopId
   * @param period
   * @returns
   */
  async getPromotionsRanking(
    payload: GetPromotionsRankingRequestDto
  ): Promise<GetPromotionsRankingResponse> {
    try {
      const { shopId, startDate, endDate } = payload;

      if (!shopId || !startDate || !endDate) {
        return {
          status: 400,
          values: [],
          errors: ["Missing parameters"],
        } as GetPromotionsRankingResponse;
      }

      const shop = await this.shopService.findOne(shopId);

      if (!shop) {
        return {
          status: 404,
          errors: ["Shop not found"],
          promotionNames: [],
          values: [],
        } as GetPromotionsRankingResponse;
      }

      const promotions = shop.promotions;

      if (!promotions || promotions.length === 0) {
        return {
          status: 404,
          errors: ["Promotions not found"],
          promotionNames: [],
          values: [],
        } as GetPromotionsRankingResponse;
      }

      let bestPromotions: { name: string; count: number }[] = [];

      for (const promotion of promotions) {
        // make a ranking of promotions based on the sum of the counters of the balances
        const balances = promotion.balances;
        let filteredBalances = [];
        filteredBalances = balances.filter((balance) => {
          return (
            balance.createdAt.toISOString()?.split("T")?.[0] >=
              payload.startDate &&
            balance.createdAt.toISOString()?.split("T")?.[0] <= payload.endDate
          );
        });

        // sum counter in balances
        const count: number = filteredBalances.reduce((acc, balance) => {
          return acc + balance.counter;
        }, 0);

        bestPromotions.push({ name: promotion.name, count: count });
      }

      // sort bestPromotions by countn desc
      bestPromotions.sort((a, b) => {
        return b.count - a.count;
      });

      bestPromotions = bestPromotions;

      return {
        status: 200,
        errors: [],
        promotionNames: bestPromotions.map((promo) => promo.name),
        values: bestPromotions.map((promo) => promo.count),
      } as GetPromotionsRankingResponse;
    } catch (error) {
      return {
        status: 500,
        errors: [error],
        promotionNames: null,
        values: null,
      } as GetPromotionsRankingResponse;
    }
  }

  /**
   * getClientsByShopId
   * @param shopId
   * @param period
   * @returns
   */
  async getClientsCount(
    payload: GetClientsCountRequestDto
  ): Promise<GetClientsCountResponse> {
    try {
      const { shopId, startDate, endDate } = payload;

      if (!shopId || !startDate || !endDate) {
        return {
          status: 400,
          value: null,
          errors: ["Missing parameters"],
        } as GetAffluenceResponse;
      }
      const shop = await this.shopService.findOne(shopId);

      if (!shop) {
        return {
          status: 404,
          value: null,
          errors: ["Shop not found"],
        } as GetClientsCountResponse;
      }

      let cards = shop.cards;

      cards = cards.filter((card) => {
        return (
          card.createdAt.toISOString()?.split("T")?.[0] >= payload.startDate &&
          card.createdAt.toISOString()?.split("T")?.[0] <= payload.endDate
        );
      });

      return {
        status: 200,
        errors: [],
        value: cards.length,
      } as GetClientsCountResponse;
    } catch (error) {
      return {
        status: 500,
        value: null,
        errors: [error],
      } as GetClientsCountResponse;
    }
  }

  /**
   * convertDate
   * @param startDate
   * @param endDate
   * @returns
   */
  convertDate(startDate: string, endDate: string) {
    // convert iso date to date
    const start = new Date(startDate);
    const end = new Date(endDate);

    return { startDate: start, endDate: end };
  }

  /**
   * checkIsoDate
   * @param isoDate
   * @returns
   * @description check if isoDate is valid
   */
  checkIsoDate(isoDate: string): boolean {
    const regex = new RegExp(/^\d{4}-\d{2}-\d{2}$/);
    return regex.test(isoDate);
  }
}
