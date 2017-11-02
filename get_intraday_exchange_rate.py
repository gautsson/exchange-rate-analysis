import requests, json, datetime, csv, collections

def get_last_row(csv_filename):
    try:
        with open(csv_filename, "r") as f:
            csv_reader = csv.reader(f)
            first_line = next(csv_reader) # so we throw an indexerror if file has only 1 line
            last_line = collections.deque(csv.reader(f), 1)[0]
            return last_line
    except StopIteration: # file is empty
        return ["2002-09-26 02:00:00"] # first date that landsbankinn has values for
    except IndexError:  # file only has headings (i.e. one line)
        return ["2002-09-26 02:00:00"]
    except FileNotFoundError: # create new file
        file = open(csv_filename, "w")
        file.write("date,exchange_rate\n")
        file.close()
        return ["2002-09-26 02:00:00"]

def get_last_50_rows(csv_filename):
    last_values = []
    with open(csv_filename, "r") as f:
        csv_reader = csv.reader(f)
        last_line = collections.deque(csv.reader(f), 50)
        for i in range(len(last_line)):
            last_values.append(last_line[i][0])
    return last_values

def get_data_to_post(date):
    return {
        "methodName": "ExchangeRatesComparison.GetHistory",
        "args": [
            "A",[
                [
                    "SEK-ISK"
                ]
            ],
            date.strftime("%Y-%m-%d") + "T01:00:00.000Z", # example format: "2017-10-11T01:00:00.000Z",
            date.strftime("%Y-%m-%d") + "T21:59:59.999Z"
        ]
    }
   
def daterange(start_date, end_date):
    start_date = start_date.replace(hour=1, minute=1)
    end_date = end_date.replace(hour=23, minute=59)
    if start_date.date() == end_date.date():
        yield start_date
    else:
        for n in range(int ((end_date - start_date).days) + 1):
            current_date = start_date + datetime.timedelta(n)
            if current_date.weekday() not in (5,6): # market is closed on weekends, so we leave out saturday and sunday
                yield current_date

def post_request(post_data, filename):
    endpoint_url = "https://www.landsbankinn.is/Services/MethodProxy.asmx/Execute"
    answer_data = []
    r = requests.post(endpoint_url, json=post_data)

    if r.status_code == 200 and r.json()["d"] != None and r.json()["d"][0] != None:
        answer_data = r.json()["d"][0][0]["data"]
    else:
        if """{"d":[null,null]}""" in r.text:
            print("No values exist for this date yet.")
        else:
            print("Error: " + r.text)

    fifty_last_rows = get_last_50_rows(filename)
    file = open(filename, "a")
    for item in answer_data:
        date = item[0]/1000 # date is in unix time with milliseconds added to it (js time)
        human_readable_date = datetime.datetime.fromtimestamp(date).strftime("%Y-%m-%d %H:%M:%S")
        # we don't want to duplicate data in the file. we can be relatively certain that 50 entries covers more than a day
        if human_readable_date not in fifty_last_rows:
            result = str(human_readable_date) + "," + str(item[1]) + "\n"
            file.write(result)
            print("Date: " + human_readable_date + " & Value: " + str(item[1]))
    file.close()

if __name__ == "__main__":
    filename = "data/landsbanki_sek_isk.csv"
    last_recorded_timestamp = datetime.datetime.strptime(get_last_row(filename)[0], "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
  
    # date from is the last date we have a value for (plus one day so we don't get the same value twice)
    date_from = datetime.datetime.strptime(last_recorded_timestamp, "%Y-%m-%d %H:%M:%S")
    date_to = datetime.datetime.now()

    print("Starting to send requests...")
    for single_date in daterange(date_from, date_to):
        print("\nRequest for: " + single_date.strftime("%A %Y-%m-%d"))
        post_request(get_data_to_post(single_date), filename)