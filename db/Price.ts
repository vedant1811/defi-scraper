import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm"

@Entity()
@Index(['chain', 'poolAddress', 'blockNumber'], { unique: true })
export class Price {

    @PrimaryGeneratedColumn()
    id: number

    /**
     * One of {@link common.UniswapChain}
     */
    @Column('text')
    chain: string

    @Column('text')
    poolAddress: string

    @Column('integer')
    blockNumber: number

    @Column('text')
    tokenSymbol: string

    /**
     * Base token (like stablecoins)
     */
    @Column('text')
    baseTokenSymbol: string

    /**
     * Price is always of tokenSymbol in baseTokenSymbol as base
     *
     * postgres Ref: https://www.postgresql.org/docs/current/datatype-numeric.html
     */
    @Column('numeric')
    tokenPrice: string

    /**
     * postgres ref: {@link https://www.postgresql.org/docs/current/datatype-datetime.html}
     */
    @Column('timestamp')
    blockTimestamp: any
}
