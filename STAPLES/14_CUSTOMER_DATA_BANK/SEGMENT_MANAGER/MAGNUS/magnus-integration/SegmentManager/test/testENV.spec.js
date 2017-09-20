describe('Env Setup::', function () {
    it('contains jasmine', function () {
        expect(typeof jasmine).toBe("object");
    });
    it('contains angular', function () {
        expect(typeof angular).toBe("object");
    });
    it('contains angular mock', function () {
        expect(typeof angular.mock).toBe("object");
    });
});