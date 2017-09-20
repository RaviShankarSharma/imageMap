describe("Common Filters Tests::", function () {
    beforeEach(module('SegmentManager'));

    var $filter;

    beforeEach(inject(function (_$filter_) {
        $filter = _$filter_;
    }));

    describe('cut', function () {
        var cut;
        beforeEach(function () {
            cut = $filter('cut');
        });
        
        it('null check', function () {            
            expect(cut(null)).toBe('');
        });

        it('value check', function () {            
            expect(cut("long text goes here", true, 5)).toBe('long …');
        });
    });

    describe('capitalizeFirstLetterOnly', function () {
        var capitalizeFirstLetterOnly;
        beforeEach(function () {
            capitalizeFirstLetterOnly = $filter('capitalizeFirstLetterOnly');
        });

        it('null check', function () {            
            expect(capitalizeFirstLetterOnly(null)).toBe(null);
        });

        it('value check', function () {
            expect(capitalizeFirstLetterOnly("saikat karmakar")).toBe("Saikat karmakar");
        });
    });

});