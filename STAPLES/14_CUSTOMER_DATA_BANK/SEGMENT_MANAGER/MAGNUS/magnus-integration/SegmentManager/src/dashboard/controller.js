angular.module('SegmentManager').controller('SegmentManagerController', ['$http','$scope',
    function ($http,$scope) {

        $scope.attr_val = true;
        $scope.save_flag = false;
        $scope.isArchive = false;
        $scope.isSegmentEdited = false;
        $scope.isSegmentSelected = false;
        $scope.selectedSegmentId = "";
        $scope.attributeIndx = 0;
        $scope.segementList = [];
        $scope.dataList = [];
        $scope.segmentNameList = [];
        $scope.segmentListData = [];
        $scope.segmentOriginalListData = [];
        $scope.segmentListFromService = [];
        $scope.attributesDescription = [];
        $scope.segmentFilterObjList = [];
        $scope.selAttributeObj = {};
        $scope.minValue = 0;
        $scope.maxValue = 0;
        $scope.selectedAttribute = "";
        $scope.selRadio = "=";
        $scope.filterDataObject = new Object();
        $scope.rangeSelectedOption = ">";
        $scope.rangeSelectedValue = 0;
        $scope.attributeListData = {};
        $scope.isRangeSelecter = false;
        $scope.ltValue = 0;
        $scope.gtValue = 0;
        $scope.popupAttributesList = new Array();
        $scope.tableColumnAttributesList = new Array();
        $scope.isSegmentStateOption = false;
        $scope.isContainsOption = false;
        $scope.isCreatedByOption = false;
        $scope.isSegmentNameOption = false;
        $scope.isSegmentDateOption = false;
    
        $scope.segmentStateVal = "";
        $scope.containsVal = "";
        $scope.createdByVal = "";
        $scope.segmentNameVal = "";
        $scope.segmentDateVal = "";
    
    
        $scope.segmentFilterVal = "You can apply filter on segment";
    
        $scope.selectedSegmentIndx = 999;
    
        $scope.customerType = [
            {id:1, name : "ACCOUNT_CUSTOMER_BANK", label : "Account Customer"},
            {id:2, name : "CONTACT_CUSTOMER_BANK", label : "Contact Customer"}
        ];
    
        $scope.segmentType = [
            {id:1, name : "Active", label : "Active Segment"},
            {id:2, name : "Archive", label : "Archive Segment"}
        ];
    
        $scope.searchByType = [
            {id:1, name : "CREATED_BY", label : "Created By"},
            {id:2, name : "SEGMENT_STATUS", label : "Segment Status"},
            {id:3, name : "SEGMENT_NAME", label : "Segment Name"},
            {id:4, name : "CREATED_DATE", label : "Created Date"}
        ];
    
        $scope.rangeOptionList = [
            {id:1, name : ">", label : ">", isSelected : true},
            {id:2, name : ">=", label : ">=", isSelected : false},
            {id:2, name : "=", label : "=", isSelected : false},
            {id:2, name : "<=", label : "<=", isSelected : false},
            {id:2, name : "<", label : "<", isSelected : false}
        ];
         
        $scope.selectedSegmentId = 1;
        $scope.selectedSegment = {id:1, name : "ACTIVE_SEGMENT", label : "Active Segment"};
    
        $scope.selectedCuctomerId = 1;
        $scope.selectedCustomer = {id:1, name : "ACCOUNT_CUSTOMER_BANK", label : "Account Customer"};
    
        $scope.selectedSearchTypeId = 1;
        $scope.selectedSearchBy = {id:1, name : "CREATED_BY", label : "Created By"};
    
    
        $scope.isFirstScreen = true;
    
        var stringAtttribute = document.getElementById('string-popup');
        var numberAtttribute = document.getElementById('number-popup');
        var dateAtttribute = document.getElementById('date-popup');
        var customerSegmentAtttribute = document.getElementById('customer-segment-popup');

        $scope.attributeFilterOptions = function(strOptionName){
            if(strOptionName === "IN"){
                $scope.selRadio = "=";
                for(var i=0; i<$scope.attributesDescription.length; i++){
                    $scope.attributesDescription[i].isSelected = false;
                }
            }else{
                $scope.selRadio = "!=";
                for(var i=0; i<$scope.attributesDescription.length; i++){
                    $scope.attributesDescription[i].isSelected = false;
                }
            }
        }
    
        $scope.selectCustomerType = function(strSelectedOption){
            $scope.attributes = new Array();
            
            for(var i=0; i<$scope.attributeListData.length; i++){
                if(strSelectedOption === $scope.attributeListData[i].grpName){
                    $scope.attributes = $scope.attributeListData[i].hrcNames;
                }
            }
        }
    
        $scope.selectSegmentType = function(){
            $scope.load_segments();
        }
    
        $scope.selectOption = function(optionIndex){
            $scope.attributesDescription[optionIndex].isSelected = !$scope.attributesDescription[optionIndex].isSelected;
        }

        $scope.selectAttributeOption = function(attributeName){

            for(var i=0; i < $scope.popupAttributesList.length; i++){
                if($scope.popupAttributesList[i].name == attributeName){
                    $scope.popupAttributesList[i].isSelected = !$scope.popupAttributesList[i].isSelected;
                }
            }
            $scope.tableColumnAttributesList = new Array();

            for(var i=0; i < $scope.popupAttributesList.length; i++){
                if($scope.popupAttributesList[i].isSelected){
                    $scope.tableColumnAttributesList.push($scope.popupAttributesList[i].name);
                }
            }
        }
    
        $scope.selectRangeOption = function(optionIndex){
            $scope.rangeOptionList[optionIndex].isSelected = !$scope.rangeOptionList[optionIndex].isSelected;
        }
    
        $scope.closePopup = function() {
            stringAtttribute.style.display = "none";
            numberAtttribute.style.display = "none";
            dateAtttribute.style.display = "none";
            customerSegmentAtttribute.style.display = "none";
        }
    
        $scope.updateRangeSelection = function(optionType){
            $scope.rangeSelectedOption = optionType;
        }
    
        $scope.buildSegment = function(dataType){
            stringAtttribute.style.display = "none";
            numberAtttribute.style.display = "none";
            dateAtttribute.style.display = "none";
            customerSegmentAtttribute.style.display = "none";
    
            var objSegment = "";
            var listSelOptions = [];
    
            if(dataType === "string"){
                for(var i=0; i<$scope.attributesDescription.length; i++){
                    if($scope.attributesDescription[i].isSelected){
                        listSelOptions.push($scope.attributesDescription[i].name); 
                    }
                }
    
                objSegment = $scope.selAttributeObj.attributeName + " " + $scope.selRadio + " " + listSelOptions.join(",");
            }else if(dataType === "number"){
    
                if($scope.isRangeSelecter){
                    objSegment = $scope.selAttributeObj.attributeName + " >= " + $scope.gtValue + " & " + $scope.selAttributeObj.attributeName + " <= " + $scope.ltValue;
                }else{
                    objSegment = $scope.selAttributeObj.attributeName + " " + $scope.rangeSelectedOption + " " + $scope.rangeSelectedValue;
                }
            }else{
                if($scope.isRangeSelecter){
                    objSegment = $scope.selAttributeObj.attributeName + " >= " + $scope.startDateRange + " & " + $scope.selAttributeObj.attributeName + " <= " + $scope.endDateRange;
                }else{
                    objSegment = $scope.selAttributeObj.attributeName + " " + $scope.rangeSelectedOption + " " + $scope.dateCondition;
                }
            }
    
            $scope.updateAttributeDetails(objSegment);
        }
    
        $scope.deleteAttribute = function(attributeName, groupIndx, rowIndex) {
            for(var i=0; i < $scope.attributes[groupIndx].attributeList.length; i++){
                if($scope.attributes[groupIndx].attributeList[i].name === attributeName){
                    $scope.attributes[groupIndx].attributeList[i].isAdded = false;
                }
            }

            $scope.segmentNameList.splice(rowIndex, 1);
            $scope.segementList.splice(rowIndex, 1);
        }
    
        $scope.removeDefination = function(rowIndx) {
            $scope.deleteAttribute($scope.segmentNameList[rowIndx].attributeName, $scope.segmentNameList[rowIndx].groupIndx, rowIndx)
        }
    
        $scope.updateAttributeDetails = function(groupObject) {
            for(var i=0; i < $scope.attributes[$scope.selAttributeObj.groupIndx].attributeList.length; i++){
                if($scope.attributes[$scope.selAttributeObj.groupIndx].attributeList[i].name === $scope.selAttributeObj.attributeName){
                    $scope.attributes[$scope.selAttributeObj.groupIndx].attributeList[i].isAdded = true;
                    
                    $scope.segmentNameList.push({"attributeName" : $scope.selAttributeObj.attributeName, "groupIndx" : $scope.selAttributeObj.groupIndx});
                    $scope.segementList.push(groupObject);
                }
            } 
        }

        $scope.updateAttributeMenu = function(segmentListArr){
            $scope.segmentNameList = new Array();
            for(var k=0; k < segmentListArr.length; k++){
                for(var i=0; i < $scope.attributes.length; i++){
                    for(var j=0; j < $scope.attributes[i].attributeList.length; j++){
                        if($scope.attributes[i].attributeList[j].name == segmentListArr[k].split(" ")[0]){
                            $scope.attributes[i].attributeList[j].isAdded = true;
                            $scope.segmentNameList.push({"attributeName" : $scope.attributes[i].attributeList[j].name, "groupIndx" : i});
                        }
                    }
                }
            }
        }
    
        $scope.showAttributeDescription = function(attributeObj, groupIndx) {
            //------------------------------------------------------------------
            var data = ATTRIBUTE_DESCRIPTION;
            $scope.loading = false;
            $scope.attributesDescription = [];
            if(attributeObj.type == "float"){
                for(var i=0; i<data.length; i++){
                    $scope.attributesDescription.push({"name":data[i], "isSelected":false});
                }
                $scope.minValue = 0;
                $scope.maxValue = 1000;
                numberAtttribute.style.display = "block";
            }else if(attributeObj.type == "string"){
                $scope.minValue = data.minValue;
                $scope.maxValue = data.maxValue;
                stringAtttribute.style.display = "block";
            }else if(attributeObj.type == "date"){
                $scope.minValue = data.minValue;
                $scope.maxValue = data.maxValue;
                dateAtttribute.style.display = "block";
            }
            $scope.selectedAttribute = attributeObj.name;
            $scope.selAttributeObj = {"attributeName":attributeObj.name, "groupIndx":groupIndx};
            //------------------------------------------------------------------
            $scope.loading = true;
            var loadAttributeData = $http.get(SERVICE_PREFIX + ATTRIBUTE_DETAILS_SERVICE + attributeName)
            .error(function(dataFromServer, status, headers, config) {
                var data = ATTRIBUTE_DESCRIPTION;
                $scope.loading = false;
                $scope.attributesDescription = [];
                if(Array.isArray(data)){
                    for(var i=0; i<data.length; i++){
                        $scope.attributesDescription.push({"name":data[i], "isSelected":false});
                    }
                    $scope.minValue = 0;
                    $scope.maxValue = 1000;
                    numberAtttribute.style.display = "block";
                }else{
                    $scope.minValue = data.minValue;
                    $scope.maxValue = data.maxValue;
                    numberAtttribute.style.display = "block";
                }
            })
            .success(function(data, status, headers, config) {
                $scope.loading = false;
                $scope.attributesDescription = [];
                if(Array.isArray(data)){
                    for(var i=0; i<data.length; i++){
                        $scope.attributesDescription.push({"name":data[i], "isSelected":false});
                    }
                    stringAtttribute.style.display = "block";
                }else{
                    $scope.minValue = data.minValue;
                    $scope.maxValue = data.maxValue;
                    numberAtttribute.style.display = "block";
                }
            });
    
            $scope.selectedAttribute = attributeName;
            $scope.selAttributeObj = {"attributeName":attributeName, "groupIndx":groupIndx};
        }
    
         $scope.load_segments = function() {
            //---------------------------
            $scope.segmentOriginalListData = SEGMENT_LIST.segmentDefinitionsList;
            $scope.segmentListData = SEGMENT_LIST.segmentDefinitionsList;
            $scope.segmentListFromService = SEGMENT_LIST.segmentDefinitionsList;
            $scope.loading = false;
            //---------------------------

            $scope.loading = true;
            var segmentsService = $http.get(SERVICE_PREFIX + SEGMENT_LIST_SERVICE)
            .success(function(dataFromServer, status, headers, config) {
                $scope.segmentOriginalListData = SEGMENT_LIST.segmentDefinitionsList;
                $scope.segmentListData = SEGMENT_LIST.segmentDefinitionsList;
                $scope.segmentListFromService = SEGMENT_LIST.segmentDefinitionsList;
                $scope.loading = false;
            })
            .error(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
                alert("#__SERVICE_ERR_load_segments");
            });
        };
    
        $scope.loadSegmentData = function(rowIndx, segmentStatus) {
            $scope.isArchive = (segmentStatus === "Archive");
            $scope.isSegmentEdited = false;
            $scope.isSegmentSelected = true;
            var segObj = $scope.segmentListData[rowIndx];
            $scope.selectedSegmentId = segObj.segmentId;
            $scope.segment_name = segObj.segmentName;
            $scope.segment_description = segObj.segmentDefination;
            $scope.segementList = segObj.segmentFilter.split("&");
            $scope.selectedSegmentIndx = rowIndx;
            $scope.dataList = [];

            $scope.updateAttributeMenu($scope.segementList);
        }
    
        $scope.filterSegmentList = function(filterObjList) {
    
            $scope.segmentListFromService = $scope.segmentOriginalListData;
    
            if($scope.segmentListFromService.length <=0) return;
    
            var filterList = new Array();
    
            if(filterObjList.length <= 0){
                filterList =  $scope.segmentListFromService
            }
            
            for(var j=0; j < filterObjList.length; j++){
                var searchData = filterObjList[j].filterVal.toLowerCase();
                filterList = new Array();
                for(var i=0; i < $scope.segmentListFromService.length; i++){
                    var categoryData = "";
                    if(filterObjList[j].segmentName === "segmentState"){
                        categoryData = $scope.segmentListFromService[i].segmentStatus.toLowerCase();
                    }else if(filterObjList[j].segmentName === "CreatedBy"){
                        categoryData = $scope.segmentListFromService[i].user.toLowerCase();
                    }else if(filterObjList[j].segmentName === "Contains"){
                        categoryData = $scope.segmentListFromService[i].segmentFilter.toLowerCase();
                    }else if(filterObjList[j].segmentName === "segmentName"){
                        categoryData = $scope.segmentListFromService[i].segmentName.toLowerCase();
                    }else{
                        categoryData = $scope.segmentListFromService[i].createdDate.toLowerCase();
                    }

                    if(searchData.search("#") > -1){
                        var difDate = showDateDiff(searchData.split("#")[0],searchData.split("#")[1]);
                        var rangeDate = showDateDiff(searchData.split("#")[0],categoryData);
                        if(isNaN(difDate) || ((rangeDate >= 0) && (rangeDate <= difDate))){
                            filterList.push($scope.segmentListFromService[i]);
                        }
                    }else{
                        if(categoryData.search(searchData) > -1 ){
                            filterList.push($scope.segmentListFromService[i]);
                        }
                    }
                }
    
                $scope.segmentListFromService = filterList;
            }
            
            $scope.isSegmentSelected = false;
            $scope.segment_name = "";
            $scope.segment_description = "";
            $scope.segementList = new Array();
            $scope.segmentListData = filterList;
    
            console.log(filterList);
        }
    
        //$scope.$watch('segment_filter_val', $scope.filterSegmentList);
    
        $scope.navigateView = function(scrIndx) {
            $scope.isSegmentSelected = false;
            $scope.segment_name = "";
            $scope.segment_description = "";
            $scope.segementList = new Array();
            $scope.dataList = new Array();
    
            if(scrIndx == 1){
                $scope.isFirstScreen = true;
                $scope.load_segments();
            }else if(scrIndx == 2){
                $scope.isFirstScreen = false;
    
                for(var j=0; j < $scope.attributes.length; j++){
                    for(var i=0; i < $scope.attributes[j].attributeList.length; i++){
                        $scope.attributes[j].attributeList[i].isAdded = false;
                    }
                }
    
            }
        }
    
        $scope.segment_create = function() {
            $scope.isFirstScreen = false;
            $scope.isSegmentEdited = false;
    
            $scope.segment_name = "";
            $scope.segment_description = "";
            $scope.segementList = new Array();
        }
    
        $scope.segment_edit = function() {
            $scope.isFirstScreen = false;
            $scope.isSegmentEdited = true;
        }
    
        $scope.segment_clone = function() {
            $scope.isFirstScreen = false;
            $scope.isSegmentEdited = false;
            $scope.segment_name = "";
        }
    
        $scope.updateSegmentStatus = function(newStatus) {
            /* var urlVal;
            if(newStatus === "archive"){
                urlVal = SERVICE_PREFIX + UPDATE_SEGMENT_STATUS_SERVICE + "?id=" + $scope.selectedSegmentId + "&segmentstatus=archive";
            }else{
                urlVal = SERVICE_PREFIX + UPDATE_SEGMENT_STATUS_SERVICE + "?id=" + $scope.selectedSegmentId + "&segmentstatus=active";
            }
    
            var updateSegmentService = $http.get(urlVal)
            .success(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
                $scope.load_segments();
            })
            .error(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
            }); */
        }
    
        $scope.buildFilterSegmentList = function(rowIndx, isChk, filterVal) {
    
            filterVal = (filterVal)?filterVal:"";
    
            if(rowIndx == 0){
                if(isChk){
                    $scope.isSegmentStateOption = !$scope.isSegmentStateOption;
                }
                $scope.segmentStateVal = filterVal;
            }else if(rowIndx == 1){
                if(isChk){
                    $scope.isContainsOption = !$scope.isContainsOption;
                }
                $scope.containsVal = filterVal;
            }else if(rowIndx == 2){
                if(isChk){
                    $scope.isCreatedByOption = !$scope.isCreatedByOption;
                }
                $scope.createdByVal = filterVal;
            }else if(rowIndx == 3){
                if(isChk){
                    $scope.isSegmentNameOption = !$scope.isSegmentNameOption;
                }
                $scope.segmentNameVal = filterVal;
            }else{
                if(isChk){
                    $scope.isSegmentDateOption = !$scope.isSegmentDateOption;
                }
                $scope.segmentDateVal = filterVal;
            }
            
    
            $scope.segmentFilterObjList = [];
    
            if($scope.isSegmentStateOption){
                $scope.segmentFilterObjList.push({"segmentName":"segmentState", "segmentLabel":"Segment State", "filterVal":$scope.segmentStateVal, "filterLabel":$scope.segmentStateVal})
            }
            if($scope.isContainsOption){
                $scope.segmentFilterObjList.push({"segmentName":"Contains", "segmentLabel":"Contains", "filterVal":$scope.containsVal, "filterLabel":$scope.containsVal})
            }
            if($scope.isCreatedByOption){
                $scope.segmentFilterObjList.push({"segmentName":"CreatedBy", "segmentLabel":"Created By", "filterVal":$scope.createdByVal, "filterLabel":$scope.createdByVal})
            }
            if($scope.isSegmentNameOption){
                $scope.segmentFilterObjList.push({"segmentName":"segmentName", "segmentLabel":"Segment Name", "filterVal":$scope.segmentNameVal, "filterLabel":$scope.segmentNameVal})
            }
            if($scope.isSegmentDateOption){
                $scope.segmentFilterObjList.push({"segmentName":"segmentDate", "segmentLabel":"Created Date", "filterVal":$scope.segmentDateVal, "filterLabel":$scope.segmentDateVal})
            }
    
            var msgArr = [];
    
            for(var i = 0; i < $scope.segmentFilterObjList.length; i++){
                msgArr.push($scope.segmentFilterObjList[i].segmentLabel + " is " + $scope.segmentFilterObjList[i].filterLabel);
            }
    
            if(msgArr.length > 0){
                $scope.segmentFilterVal = "Where " + msgArr.join(" AND ");
            }else{
                $scope.segmentFilterVal = "";
            }
    
            $scope.filterSegmentList($scope.segmentFilterObjList);
        }
    
        $scope.saveSegment = function() {
            /* if (document.getElementById('segment_name').value == "") {
                alert("SegmentName must be filled out");
                return false;
            }
            if (document.getElementById('segment_shortdesc').value == "") {
                alert("SegmentShortDesc must be filled out");
                return false;
            }
    
            $scope.isFirstScreen = true;
            $scope.loading = true; 
    
            if($scope.isSegmentEdited){
                var dataObjectUpdate = {
                    "segmentId":$scope.selectedSegmentId,
                    "segmentName":$scope.segment_name,
                    "segmentDefination":$scope.segment_description,
                    "segmentFilter":$scope.segementList.join("&")
                };
        
                var saveSegmentService = $http.post(SERVICE_PREFIX + UPDATE_SEGMENT_DATA_SERVICE, dataObjectUpdate)
                .success(function(dataFromServer, status, headers, config) {
                    $scope.loading = false;
                    alert(dataFromServer);
                })
                .error(function(data, status, headers, config) {
                    $scope.loading = false;
                });
            }else{
                var dataObjectCreate = {
                    "segmentName":$scope.segment_name,
                    "segmentDefination":$scope.segment_description,
                    "segmentFilter":$scope.segementList.join("&")
                };
        
                var saveSegmentService = $http.post(SERVICE_PREFIX + SAVE_SEGMENT_DEFINATION_SERVICES, dataObjectCreate)
                .success(function(dataFromServer, status, headers, config) {
                    $scope.loading = false;
                    alert(dataFromServer);
                })
                .error(function(data, status, headers, config) {
                    $scope.loading = false;
                });  
            }  */
        }
    
        $scope.updateFilterValue = function(rowIndex, updatedData) {
            $scope.segementList[rowIndex] = updatedData;
        }
    
        $scope.load_attributes = function() {
            /* //----------------
            var dataFromServer = ATTRIBUTE_LIST_UPDATED;
            $scope.attributeListData = dataFromServer;
            $scope.selectCustomerType("ACCOUNT_CUSTOMER_BANK");
            
            $scope.popupAttributesList = new Array();
            $scope.tableColumnAttributesList = new Array();

            for(var i=0; i < $scope.attributes.length; i++){
                if($scope.attributes[i].hrcName == "Identifier"){
                    for(var j=0; j < $scope.attributes[i].attributeList.length; j++){
                        $scope.tableColumnAttributesList.push($scope.attributes[i].attributeList[j].name);
                        $scope.popupAttributesList.push({"name":$scope.attributes[i].attributeList[j].name, "isSelected":true});
                    }
                }else{
                    for(var k=0; k < $scope.attributes[i].attributeList.length; k++){
                        $scope.popupAttributesList.push({"name":$scope.attributes[i].attributeList[k].name, "isSelected":false});
                    }
                }
            }

            //----------------

             */
            $scope.loading = true;
    
            var attributsService = $http.get(SERVICE_PREFIX + ATTRIBUTE_LIST_SERVICE)
            .success(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
                
                $scope.attributeListData = dataFromServer;
                $scope.selectCustomerType("ACCOUNT_CUSTOMER_BANK");
                
                $scope.popupAttributesList = new Array();
                $scope.tableColumnAttributesList = new Array();
    
                for(var i=0; i < $scope.attributes.length; i++){
                    if($scope.attributes[i].hrcName == "Identifier"){
                        for(var j=0; j < $scope.attributes[i].attributeList.length; j++){
                            $scope.tableColumnAttributesList.push($scope.attributes[i].attributeList[j].name);
                            $scope.popupAttributesList.push({"name":$scope.attributes[i].attributeList[j].name, "isSelected":true});
                        }
                    }else{
                        for(var k=0; k < $scope.attributes[i].attributeList.length; k++){
                            $scope.popupAttributesList.push({"name":$scope.attributes[i].attributeList[k].name, "isSelected":false});
                        }
                    }
                }
            })
            .error(function(dataFromServer__, status, headers, config) {
                $scope.loading = false;
                alert("#___SERVICE_ERR_load_attributes")
            });
        };
    
        $scope.fetchDetails = function() {
            //-------------
            $scope.dataList = TABLE_LIST; 
            //-------------
            /* 
            $scope.loading = true;        
            var dataObject = $scope.segementList.join("&");
    
            var attributsService = $http.post(SERVICE_PREFIX + FILTERDATA_LIST_SERVICE, dataObject)
            .success(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
                $scope.dataList = dataFromServer;
            })
            .error(function(data, status, headers, config) {
                $scope.loading = false;
                $scope.dataList = TABLE_LIST; 
            }); */
        }

        $scope.updateAttribute = function() {
            customerSegmentAtttribute.style.display = "block";
        }

        $scope.downloadCustomerData = function() {
            
        }

        $scope.exportCustomerData = function() {
            
        }
    
        $scope.countAddedAttribute = function(attributeList) {        
            var x = 0;
            for(var i=0; i < attributeList.length; i++){
                if(attributeList[i].isAdded){
                    x++;
                }
            }
            return x;
        }
    
        $scope.load_attributes();
        $scope.load_segments();
    }
]);