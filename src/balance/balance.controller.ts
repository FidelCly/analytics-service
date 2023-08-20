import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { BALANCE_SERVICE_NAME } from "../analytics.pb";
import { CreateOrUpdateBalanceDto } from "./balance.dto";
import { BalanceService } from "./balance.service";
import { TransactionService } from "src/transaction/transaction.service";

@Controller()
export class BalanceController {
  constructor(
    private service: BalanceService,
    private transactionService: TransactionService
  ) {}

  @GrpcMethod(BALANCE_SERVICE_NAME, "Send")
  async createOrUpdate(createOrUpdateBalanceDto: CreateOrUpdateBalanceDto) {
    const balance = await this.service.findOne(+createOrUpdateBalanceDto.id);

    await this.transactionService.create({
      balanceId: createOrUpdateBalanceDto.id,
    });

    if (balance) {
      return this.service.update(
        +createOrUpdateBalanceDto.promotionId,
        createOrUpdateBalanceDto
      );
    } else {
      return this.service.create(createOrUpdateBalanceDto);
    }
  }
}
