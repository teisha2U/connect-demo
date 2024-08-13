
/**
 * Produces cartesian product of n arrays.
 * @param {*} groups Array of arrays to get product of
 */
 function cartesianProduct(groups){
    // These 2 lines are courtesy of user rsp at stackoverflow
    // https://stackoverflow.com/a/43053803

    // f produces cartesian product of 2 sets 
    const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
    
    // cartesian recursively calls f to produce cartesian of n sets.
    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);

    return cartesian(...groups).sort()
}

/**
 * Accepts a string and expands out to array of possibilities based on groups
 * e.g. "(a|b) and (c)?" is all combinations of a|b and optional c. 
 * @param {*} toExplode string with (thing) or (thing)? to explode
 */
function explodeString(toExplode){
    // pull out all the groups into an array.
    const groups = toExplode.match(/\((.*?)\)\??/gm);

    // holds an array of arrays of the different group values
    const splitGroups = []

    const res = []

    // convert groups into array of array of possible values
    groups.forEach((group) => {
        let groupItems = []
        let groupString = ""
        if(group.endsWith("?")){
            // remove brackets and question mark
            groupString = group.substr(1, group.length - 3)
            // split into items
            groupItems = groupString.split("|")
            // add extra blank item for optional
            groupItems.push("")
        }else{
            groupString = group.substr(1, group.length - 2)
            groupItems = groupString.split("|")
        }
        // console.log(groupItems)
        splitGroups.push(groupItems)
    })

    // generate array of arrays of all possible combinations of groups.
    const combinations = cartesianProduct(splitGroups)

    // Sub all those different group combinations back into original string.
    combinations.forEach((combination)=>{
        let thisResult = toExplode

        if(typeof combination === "string"){
            combination = [combination]
        }

        groups.forEach((group, index) => {
            thisResult = thisResult.replace(group,combination[index])
        })

        // Fix whitespace issues.
        thisResult = thisResult.replace(/[ ]{2,}/gm, " ")
        thisResult = thisResult.trim()
        
        res.push(thisResult)
    })
    return res
}


/**
 * Explodes sample utterances for slots and intents.
 * @param {*} model Bot model to explode utterances for
 */
function explodeUtterances(model){
    // if (!model.resource.intents || !model.resource.intents.length) {
    //     return model;
    // }
    if (!model.sampleUtterances || !model.sampleUtterances.length) {
        return model
    }
    
    // Don't mutate the input, make a deep clone instead.
    // Return the mutated clone.
    const intent = JSON.parse(JSON.stringify(model));

    // modelNext.resource.intents.forEach(intent => {
        // if (!intent.sampleUtterances || !intent.sampleUtterances.length) {
        //     return 
        // }

        // Handle intent utterances
        intent.sampleUtterances = explodeArray(intent.sampleUtterances)
        
        // Handle intent's slot sample utterances.
        if(intent.slots && intent.slots.length > 0){
            intent.slots.forEach(slot => {
                if (slot.sampleUtterances) {
                    slot.sampleUtterances = explodeArray(slot.sampleUtterances)
                }
            })
        }

    // })

    return intent
}



function explodeUtterancesV2(model){

    if ((!model.sampleUtterances || !model.sampleUtterances.length) &&
        (!model.slots || !model.slots.length)) {
            return model
    }
    
    // Don't mutate the input, make a deep clone instead.
    // Return the mutated clone.
    const intent = JSON.parse(JSON.stringify(model));

    if (intent.sampleUtterances && intent.sampleUtterances.length > 0) {
        const explodedUtterances = intent.sampleUtterances.map((element => {
            const newUtterances = explodeArray([element.utterance])
            console.log("Explode utterance (single element array): " + element.utterance + " - exploded to " + newUtterances.length + " utterances.")
            return newUtterances.map((splodedElem) => {
                return {utterance: splodedElem}
            })
        })).flat()
        intent.sampleUtterances =  dedup(explodedUtterances)
    }
    console.log(`${intent.sampleUtterances.length} utterances after explosion (Max allowed is 1500)`, intent.sampleUtterances)
        
        // Handle intent's slot sample utterances.
    if(intent.slots && intent.slots.length > 0){
        intent.slots.forEach(slot => {
            if (slot.valueElicitationSetting && slot.valueElicitationSetting.sampleUtterances) {
                slot.valueElicitationSetting.sampleUtterances = slot.valueElicitationSetting.sampleUtterances.map((element => {
                    const newUtterances = explodeArray([element.utterance])
                    return newUtterances.map((splodedElem) => {
                        return {utterance: splodedElem}
                    })
                })).flat()
            }
        })
    }

    // })

    return intent
}


function dedup(originalArray) {

    const deduped =  Array.from(originalArray).reduce((acc, current) => {
            // console.log ("    SEARCHING", current)
            const foundUtterance = acc.find(phrase => phrase.utterance === current.utterance);
            // console.log ("    FOUND", foundUtterance)
            if (current.utterance && (typeof foundUtterance === "undefined" || !foundUtterance )) {
                return acc.concat([current])
            } else {
                return acc;
            }
        }, [])
    // console.log("DEDUPED: ", deduped)
    return deduped
}

/**
 * Returns true if string has groups in to explode.
 * @param {*} toCheck string to check if needs exploding
 */
function stringNeedsExploding(toCheck){
    if (typeof toCheck === "undefined" || !toCheck) {
        console.log ("Could not check undefined")
        return false
    }
    const groups = toCheck.match(/\((.*?)\)\??/gm);
    return (Array.isArray(groups) && groups.length > 0)
}

/**
 * Accepts an array of strings and returns array of all strings exploded.
 * @param {*} toExplode array of strings to explode 
 */
function explodeArray(toExplode){
    let newArray = []
    toExplode.forEach(stringToExplode => {
        if(stringNeedsExploding(stringToExplode)){
            newArray = newArray.concat(explodeString(stringToExplode))
        }else{
            newArray.push(stringToExplode)
        }
    })
 return newArray
}

module.exports = {
    explodeString,
    explodeArray,
    explodeUtterances,
    explodeUtterancesV2
}