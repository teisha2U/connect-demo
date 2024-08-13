export class DateUtil {
    /**
     * Expected format is YYYY-MM-DD
     */
    public static validateLexDate(lexDate: string): void {
        if (!lexDate.match(this.descendingPattern) && !lexDate.match(this.usPattern)) {
            throw new Error("Expected date format is YYYY-MM-DD or MMDDYYYY");
        }
    }

    public static lexDateToApiDate(lexDate: string): string {
        this.validateLexDate(lexDate);
        if (lexDate.match(this.descendingPattern)) {
            return lexDate.substr(5, 2) + lexDate.substr(8, 2) + lexDate.substr(0, 4);
        } else {
            return lexDate;
        }
    }

    /**
     * Returns yesterdays date
     */
    public static yesterday(): Date {
        return this.addDays(new Date(), -1);
    }

    /**
     * Returns a new date object with incremented date.
     */
    public static addDays(date: Date, days: number): Date {
        const d: Date = new Date();
        d.setDate(date.getDate() + days);
        return d;
    }

    /**
     * Returns date a year from now
     */
    public static nextYear(): Date {
        const d: Date = new Date();
        d.setDate(d.getDate() + 365);
        return d;
    }

    /**
     * Converts date to linux epoch (for dynamo ttl)
     */
    public static toEpoch(d: Date): number {
        return Math.floor(d.getTime() / 1000);
    }

    /**
     * Returns number representation of a date - for storing in dynamo
     */
    public static timestamp(): number {
        const d: Date = new Date();
        return d.getTime();
    }

    public static diffDays(firstDate: Date, secondDate: Date): number {
        const oneDay: number = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

        return Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay));
    }

    public static getTTL( days: number) {
        const currentDate = new Date();
        currentDate.setHours(23, 59, 59, 0);
        const ttl = currentDate.getTime() / 1000 + ( days * 24 * 60 *60  );
        return ttl;
    }

    /**
     * Used to sign api requests
     */
    public static canonicalDate(): string {
        const today: Date = new Date();
        return today.toISOString().split("T")[0].replace(/-/g, "");
    }

    private static descendingPattern: RegExp = /\d\d\d\d-\d\d-\d\d/g; // YYYY-MM-DD
    private static usPattern: RegExp = /\d\d\d\d\d\d\d\d/g; // MMDDYYYY
}
